#!/usr/bin/env python3
"""
Sync BGP ASN Info from bgp.tools
定期從 bgp.tools 下載 CSV dumps，更新本地 BgpAsnInfo 資料表
"""

import csv
import urllib.request
from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://securityweb:securityweb123@localhost:5432/securityweb"
)

engine = create_engine(DATABASE_URL)

ASN_CSV_URL = "https://bgp.tools/asns.csv"

def sync_asn_info():
    """下載並同步 AS 資訊"""
    print(f"Downloading ASN data from {ASN_CSV_URL}...")

    try:
        with urllib.request.urlopen(ASN_CSV_URL) as response:
            reader = csv.DictReader(response.read().decode('utf-8').splitlines())

            count = 0
            with engine.connect() as conn:
                for row in reader:
                    try:
                        asn = int(row.get('asn', 0))
                        if asn == 0:
                            continue

                        conn.execute(text("""
                            INSERT INTO "BgpAsnInfo" (asn, name, country)
                            VALUES (:asn, :name, :country)
                            ON CONFLICT (asn) DO UPDATE SET
                                name = EXCLUDED.name,
                                country = EXCLUDED.country
                        """), {
                            'asn': asn,
                            'name': row.get('name', ''),
                            'country': row.get('country', '')
                        })
                        count += 1
                    except Exception as e:
                        print(f"Error processing row: {e}")

                print(f"Synced {count} ASN records")

    except Exception as e:
        print(f"Sync failed: {e}")

if __name__ == "__main__":
    sync_asn_info()