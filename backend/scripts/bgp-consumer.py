#!/usr/bin/env python3
"""
BGP Consumer - RIPE RIS Live WebSocket to PostgreSQL
串接 RIPE RIS Live WebSocket，即時寫入 BGP update 到 PostgreSQL

寫入策略：buffered flush，**非** multi-row bulk insert
--------------------------------------------------------
- WebSocket 收到 update 後推進 `_update_buffer`（asyncio.Lock 保護）
- 達到 `BATCH_SIZE` (100) 筆或 `BATCH_TIMEOUT_SECONDS` (5) 秒觸發 `_flush_buffer`
- `_flush_buffer()` 在**單一 transaction** 內對每一筆依序執行
  `INSERT INTO "BgpUpdate" ...`，**逐筆 INSERT**，未使用 `executemany` /
  `execute_batch` / 多列 `INSERT ... VALUES (...), (...), ...`
- 因此目前實作並非「bulk insert」，只是「在單一 transaction 內的 row-by-row flush」；
  對 PG 來說網路 round-trip 與 WAL flush 次數仍隨 N 線性成長
- 升級為真 multi-row bulk 的計畫見 P2 backlog（將單一 transaction 改寫為
  `execute_batch` 或單一 multi-row INSERT，可降低 ~5-10× 寫入延遲）
"""

import json
import asyncio
import websockets
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text
import os

# RIPE RIS Live WebSocket URL
RIS_URL = "wss://ris-live.ripe.net/v1/ws"

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://securityweb:securityweb123@localhost:5432/securityweb"
)

engine = create_engine(DATABASE_URL)

# Batch configuration
BATCH_SIZE = 100
BATCH_TIMEOUT_SECONDS = 5

# Log configuration (low-frequency logging)
LOG_INTERVAL_SECONDS = 300  # 5 minutes
_last_log_time = None
_updates_since_last_log = 0
_total_updates_flushed = 0

# ASN -> Country cache (loaded once, refreshed periodically)
_asn_country_cache = {}
_cache_loaded_at = None
CACHE_TTL_SECONDS = 300  # 5 minutes

# Batch buffer
_update_buffer = []
_buffer_lock = asyncio.Lock()

def _load_asn_country_cache():
    """Load ASN -> Country mapping from BgpAsnInfo into memory cache."""
    global _asn_country_cache, _cache_loaded_at
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT asn, country FROM \"BgpAsnInfo\" WHERE country IS NOT NULL AND country != ''"))
            _asn_country_cache = {row[0]: row[1] for row in result}
            _cache_loaded_at = datetime.now()
            print(f"Loaded {len(_asn_country_cache)} ASN country mappings into cache")
    except Exception as e:
        print(f"Failed to load ASN country cache: {e}")

def _get_country_for_asn(origin_asn):
    """Get country code for an ASN, using memory cache."""
    global _cache_loaded_at
    if _cache_loaded_at is None or (datetime.now() - _cache_loaded_at).total_seconds() > CACHE_TTL_SECONDS:
        _load_asn_country_cache()
    return _asn_country_cache.get(origin_asn)

async def _flush_buffer():
    """Flush the update buffer to database in a single transaction.

    Note: This is row-by-row INSERT inside one transaction (buffered flush),
    NOT a multi-row bulk insert. Each iteration sends its own INSERT statement
    to PostgreSQL. See module docstring for the rationale and the P2 backlog
    item to upgrade to `execute_batch` / multi-row `VALUES (...)`.
    """
    global _update_buffer, _updates_since_last_log, _total_updates_flushed, _last_log_time
    if not _update_buffer:
        return 0

    async with _buffer_lock:
        # Swap buffer to avoid holding lock during DB operation
        updates_to_flush = _update_buffer
        _update_buffer = []

    if not updates_to_flush:
        return 0

    try:
        with engine.begin() as conn:
            # Row-by-row INSERT inside one transaction. Not bulk.
            for u in updates_to_flush:
                try:
                    ts = u.get('timestamp')
                    if isinstance(ts, (int, float)):
                        ts = datetime.fromtimestamp(ts, tz=timezone.utc)
                    u['timestamp'] = ts
                    conn.execute(text("""
                        INSERT INTO "BgpUpdate"
                        (prefix, "asPath", "peerAsn", "originAsn", timestamp, type, source, country)
                        VALUES (:prefix, :as_path, :peer_asn, :origin_asn, :timestamp, :type, :source, :country)
                    """), u)
                except Exception as e:
                    print(f"DB insert error: {e}")

        count = len(updates_to_flush)
        _updates_since_last_log += count
        _total_updates_flushed += count

        # Low-frequency logging (every LOG_INTERVAL_SECONDS)
        now = datetime.now()
        if _last_log_time is None or (now - _last_log_time).total_seconds() >= LOG_INTERVAL_SECONDS:
            print(f"[STATS] Flushed {_updates_since_last_log} updates in last {LOG_INTERVAL_SECONDS}s | Total: {_total_updates_flushed}")
            _updates_since_last_log = 0
            _last_log_time = now

        return count
    except Exception as e:
        print(f"Batch flush error: {e}")
        # Put updates back in buffer on failure
        async with _buffer_lock:
            _update_buffer = updates_to_flush + _update_buffer
        return 0

def parse_bgp_update(msg):
    """解析 BGP update 訊息"""
    try:
        data = msg.get("data", {})
        if data.get("type") != "UPDATE":
            return None

        path = data.get("path", [])
        origin_asn = path[-1] if path else None
        peer_asn = data.get("peer_asn")
        host = data.get("host")
        timestamp = data.get("timestamp")
        announcements = data.get("announcements", [])
        withdrawals = data.get("withdrawals", [])

        updates = []
        for a in announcements:
            prefixes = a.get("prefixes", [])
            for prefix in prefixes:
                updates.append({
                    "prefix": prefix,
                    "as_path": " ".join(map(str, path)) if path else None,
                    "origin_asn": origin_asn,
                    "peer_asn": peer_asn,
                    "timestamp": timestamp,
                    "type": "A",
                    "source": host,
                    "country": _get_country_for_asn(origin_asn),
                })

        for w in withdrawals:
            prefixes = w.get("prefixes", [])
            for prefix in prefixes:
                updates.append({
                    "prefix": prefix,
                    "as_path": None,
                    "origin_asn": None,
                    "peer_asn": peer_asn,
                    "timestamp": timestamp,
                    "type": "W",
                    "source": host,
                    "country": None,
                })

        return updates
    except Exception as e:
        print(f"Parse error: {e}")
        return None

async def run():
    """主要執行迴圈"""
    print("Connecting to RIPE RIS Live...")
    _load_asn_country_cache()

    # Start the batch flusher task
    flush_task = asyncio.create_task(_batch_flusher())

    while True:
        try:
            async with websockets.connect(RIS_URL) as ws:
                print("Connected! Receiving BGP updates...")

                # Subscribe to all BGP updates
                await ws.send(json.dumps({
                    "type": "ris_subscribe",
                    "data": {
                        "socket": "rrc10",
                        "packet_type": ["UPDATE"]
                    }
                }))

                while True:
                    try:
                        msg = await ws.recv()
                        msg_data = json.loads(msg)

                        updates = parse_bgp_update(msg_data)
                        if updates:
                            async with _buffer_lock:
                                _update_buffer.extend(updates)
                                should_flush = len(_update_buffer) >= BATCH_SIZE
                            # Debug log only at startup or on first batch
                            if _total_updates_flushed == 0 and len(_update_buffer) <= BATCH_SIZE:
                                print(f"Buffered {len(updates)} updates, buffer size: {len(_update_buffer)}")
                            if should_flush:
                                await _flush_buffer()

                    except websockets.exceptions.ConnectionClosed:
                        print("Connection closed, reconnecting...")
                        break

        except Exception as e:
            print(f"Connection error: {e}")
            await asyncio.sleep(5)

    # Cleanup flush task on exit
    flush_task.cancel()

async def _batch_flusher():
    """Periodically flush the buffer."""
    while True:
        await asyncio.sleep(BATCH_TIMEOUT_SECONDS)
        await _flush_buffer()

if __name__ == "__main__":
    asyncio.run(run())
