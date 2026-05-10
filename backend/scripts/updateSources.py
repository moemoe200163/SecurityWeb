#!/usr/bin/env python3
"""Update sources field for all IpReputation records."""

import psycopg2

DATABASE_URL = "postgresql://securityweb:securityweb123@db:5432/securityweb"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Update sources for all records where sources is NULL
    cur.execute("""
        UPDATE "IpReputation"
        SET sources = '[{"name": "IPsum", "listCount": 5}]'::jsonb
        WHERE sources IS NULL
    """)

    conn.commit()
    print(f"Updated {cur.rowcount} records")

    # Verify
    cur.execute('SELECT COUNT(*) FROM "IpReputation" WHERE sources IS NOT NULL')
    print(f"Total records with sources: {cur.fetchone()[0]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()