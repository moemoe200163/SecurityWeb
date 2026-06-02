#!/usr/bin/env python3
"""
BGP Consumer - RIPE RIS Live WebSocket to PostgreSQL
串接 RIPE RIS Live WebSocket，即時寫入 BGP update 到 PostgreSQL
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

# ASN -> Country cache (loaded once, refreshed periodically)
_asn_country_cache = {}
_cache_loaded_at = None
CACHE_TTL_SECONDS = 300  # 5 minutes

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
                    with engine.begin() as conn:
                        for u in updates:
                            try:
                                # Convert Unix timestamp to datetime
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
                    print(f"Inserted {len(updates)} updates at {datetime.now().isoformat()}")

            except websockets.exceptions.ConnectionClosed:
                print("Connection closed, reconnecting...")
                await asyncio.sleep(5)
                await run()

if __name__ == "__main__":
    asyncio.run(run())
