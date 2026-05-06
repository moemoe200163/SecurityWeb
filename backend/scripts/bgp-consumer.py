#!/usr/bin/env python3
"""
BGP Consumer - RIPE RIS Live WebSocket to PostgreSQL
串接 RIPE RIS Live WebSocket，即時寫入 BGP update 到 PostgreSQL
"""

import json
import asyncio
import websockets
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import os

# RIPE RIS Live WebSocket URL
RIS_URL = "wss://ris-live.ripe.net/ws/?rs=rrc10"

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://securityweb:securityweb123@localhost:5432/securityweb"
)

engine = create_engine(DATABASE_URL)

def parse_bgp_update(msg):
    """解析 BGP update 訊息"""
    try:
        data = msg.get("data", {})
        if data.get("type") != "UPDATE":
            return None

        announcements = data.get("announcements", [])
        withdrawals = data.get("withdrawals", [])

        updates = []
        for a in announcements:
            updates.append({
                "prefix": a.get("prefix"),
                "as_path": a.get("path"),
                "origin_asn": a.get("origin_asn"),
                "peer_asn": data.get("peer_asn"),
                "timestamp": data.get("timestamp"),
                "type": "A",
                "source": data.get("source_id"),
            })

        for w in withdrawals:
            updates.append({
                "prefix": w.get("prefix"),
                "as_path": None,
                "origin_asn": None,
                "peer_asn": data.get("peer_asn"),
                "timestamp": data.get("timestamp"),
                "type": "W",
                "source": data.get("source_id"),
            })

        return updates
    except Exception as e:
        print(f"Parse error: {e}")
        return None

async def run():
    """主要執行迴圈"""
    print("Connecting to RIPE RIS Live...")
    async with websockets.connect(RIS_URL) as ws:
        print("Connected! Receiving BGP updates...")

        # Subscribe to all BGP updates
        await ws.send(json.dumps({
            "type": "ris_message",
            "data": {
                "kind": "ris_subscribe",
                "data": {
                    "socket": "rrc10",
                    "packet_type": ["UPDATE"]
                }
            }
        }))

        while True:
            try:
                msg = await ws.recv()
                msg_data = json.loads(msg)

                updates = parse_bgp_update(msg_data)
                if updates:
                    with engine.connect() as conn:
                        for u in updates:
                            try:
                                conn.execute(text("""
                                    INSERT INTO "BgpUpdate"
                                    (prefix, "asPath", "peerAsn", "originAsn", timestamp, type, source)
                                    VALUES (:prefix, :as_path, :peer_asn, :origin_asn, :timestamp, :type, :source)
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