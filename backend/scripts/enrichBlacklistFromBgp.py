#!/usr/bin/env python3
"""
Enrich IP blacklist data with BGP/Geo information from RIPEstat API.
Reads IPs with missing countryCode AND countryName from IpReputation table,
queries RIPEstat API for enrichment data, and updates the database.
"""

import time
import psycopg2
import requests
from typing import Optional, Dict, Any, Tuple


# Database connection
DATABASE_URL = "postgresql://securityweb:securityweb123@db:5432/securityweb"

# RIPEstat API endpoints - use prefix-overview for IPs
RIPESTAT_PREFIX_OVERVIEW_URL = "https://stat.ripe.net/data/prefix-overview/data.json?resource={ip}"
RIPESTAT_RIR_GEO_URL = "https://stat.ripe.net/data/rir-geo/data.json?resource={ip}"

# Rate limiting
API_SLEEP_SECONDS = 0.3
COMMIT_BATCH_SIZE = 50
MAX_RECORDS = 500


def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(DATABASE_URL)


def fetch_ripestat_data(url: str) -> Optional[Dict[str, Any]]:
    """Fetch JSON data from RIPEstat API with error handling."""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"    Warning: API request failed: {e}")
        return None


def get_enrichment_from_ripestat(ip: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Get country, ISP/holder, and ASN info from RIPEstat for an IP address.
    Returns: (country_code, country_name, isp/holder)
    """
    country_code = None
    country_name = None
    isp = None

    # Use prefix-overview which works with IP addresses
    url = RIPESTAT_PREFIX_OVERVIEW_URL.format(ip=ip)
    data = fetch_ripestat_data(url)

    if data and data.get("status") == "ok":
        try:
            # Get ASN info from the asns array
            asns = data.get("data", {}).get("asns", [])
            if asns:
                # Get holder from first ASN (primary origin)
                holder = asns[0].get("holder")
                if holder:
                    isp = holder
        except Exception as e:
            print(f"    Warning: Failed to parse prefix-overview response: {e}")

    # Get country from rir-geo
    geo_url = RIPESTAT_RIR_GEO_URL.format(ip=ip)
    geo_data = fetch_ripestat_data(geo_url)

    if geo_data and geo_data.get("status") == "ok":
        try:
            # rir-geo returns located_resources array
            resources = geo_data.get("data", {}).get("located_resources", [])
            for r in resources:
                # location can be a string (country code) or dict
                location = r.get("location")
                if isinstance(location, dict):
                    country_code = location.get("country_code")
                    country_name = location.get("name")
                else:
                    # location is a string (country code like "US")
                    country_code = location
                    country_name = None
                if country_code:
                    break
        except Exception as e:
            print(f"    Warning: Failed to parse rir-geo response: {e}")

    return country_code, country_name, isp


def main():
    """Main function to enrich IP blacklist data."""
    print("Starting IP enrichment from RIPEstat API...")
    print(f"Database: {DATABASE_URL}")
    print(f"Max records: {MAX_RECORDS}, Commit batch size: {COMMIT_BATCH_SIZE}")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch IPs where both countryCode AND countryName are NULL
    print("\nFetching IPs with missing countryCode AND countryName...")
    cursor.execute("""
        SELECT id, "ipAddress"
        FROM "IpReputation"
        WHERE "countryCode" IS NULL AND "countryName" IS NULL
        LIMIT %s
    """, (MAX_RECORDS,))

    ips_to_enrich = cursor.fetchall()
    print(f"Found {len(ips_to_enrich)} IPs to enrich")

    if not ips_to_enrich:
        print("No IPs to enrich. Exiting.")
        cursor.close()
        conn.close()
        return

    # Process each IP
    updated_count = 0
    error_count = 0

    for idx, (record_id, ip) in enumerate(ips_to_enrich, 1):
        print(f"[{idx}/{len(ips_to_enrich)}] Processing {ip}...", end=" ")

        try:
            country_code, country_name, isp = get_enrichment_from_ripestat(ip)
            print(f"Country: {country_code or 'N/A'}, ISP: {isp or 'N/A'}")

            # Update database if we have any data
            if country_code or country_name or isp:
                cursor.execute("""
                    UPDATE "IpReputation"
                    SET "countryCode" = %s,
                        "countryName" = %s,
                        isp = %s,
                        "updatedAt" = NOW()
                    WHERE id = %s
                """, (country_code, country_name, isp, record_id))
                updated_count += 1
            else:
                print(f"    No enrichment data available")

            # Commit every COMMIT_BATCH_SIZE records
            if updated_count > 0 and updated_count % COMMIT_BATCH_SIZE == 0:
                conn.commit()
                print(f"  >> Committed batch at {updated_count} records")

            # Rate limiting
            time.sleep(API_SLEEP_SECONDS)

        except Exception as e:
            error_count += 1
            print(f"  ERROR: {e}")

    # Final commit for remaining records
    conn.commit()
    print(f"\nCompleted!")
    print(f"  Updated: {updated_count} records")
    print(f"  Errors: {error_count} records")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
