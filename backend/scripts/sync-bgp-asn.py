#!/usr/bin/env python3
"""
Sync BGP ASN Info from RIPE RIPEstat API
定時從 RIPE RIPEstat 查詢 AS 資訊，更新本地 BgpAsnInfo 資料表
"""

import json
import urllib.request
import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://securityweb:securityweb123@localhost:5432/securityweb"
)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def get_asn_info_from_ripestat(asn):
    """從 RIPE RIPEstat API 查詢 AS 資訊"""
    country = None
    holder = None

    # 取得地理資訊 (國家) - 使用 rir-geo
    try:
        url = f"https://stat.ripe.net/data/rir-geo/data.json?resource=AS{asn}"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'data' in data and 'located_resources' in data['data']:
                for r in data['data']['located_resources']:
                    if r.get('resource') == str(asn) and r.get('location'):
                        country = r.get('location')
                        break
    except Exception as e:
        print(f"  Error fetching geography for ASN {asn}: {e}")

    # 取得組織名稱 (holder) - 使用 as-overview
    try:
        url = f"https://stat.ripe.net/data/as-overview/data.json?resource=AS{asn}"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if 'data' in data and 'holder' in data['data']:
                holder = data['data']['holder']
    except Exception as e:
        print(f"  Error fetching holder for ASN {asn}: {e}")

    return country, holder

def sync_asn_info():
    """從資料庫取得所有獨特的 originASN，查詢並更新國家資訊"""
    print("Fetching unique ASNs from BgpUpdate...")

    with engine.connect() as conn:
        # 取得所有獨特的 originASN
        result = conn.execute(text("""
            SELECT DISTINCT "originAsn"
            FROM "BgpUpdate"
            WHERE "originAsn" IS NOT NULL
        """))
        asns = [row[0] for row in result.fetchall()]

    print(f"Found {len(asns)} unique ASNs to process")

    session = Session()
    for asn in asns:
        country, holder = get_asn_info_from_ripestat(asn)
        if country or holder:
            try:
                session.execute(text("""
                    INSERT INTO "BgpAsnInfo" (asn, country, name, "updatedAt")
                    VALUES (:asn, :country, :name, NOW())
                    ON CONFLICT (asn) DO UPDATE SET
                        country = COALESCE(EXCLUDED.country, "BgpAsnInfo".country),
                        name = COALESCE(EXCLUDED.name, "BgpAsnInfo".name),
                        "updatedAt" = NOW()
                """), {'asn': asn, 'country': country, 'name': holder})
                print(f"Updated ASN {asn}: country={country}, name={holder}")
            except Exception as e:
                print(f"Error updating ASN {asn}: {e}")

    session.commit()
    session.close()

def main():
    """主要執行函數"""
    print("Starting BGP ASN sync...")
    sync_asn_info()
    print("BGP ASN sync completed")

if __name__ == "__main__":
    main()
