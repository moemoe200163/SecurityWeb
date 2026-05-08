#!/usr/bin/env python3
"""清理過期的 BGP 記錄"""
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://securityweb:securityweb123@localhost:5432/securityweb"
)

engine = create_engine(DATABASE_URL)

cutoff = datetime.now() - timedelta(hours=24)
with engine.connect() as conn:
    result = conn.execute(text("""
        DELETE FROM "BgpUpdate" WHERE timestamp < :cutoff
    """), {"cutoff": cutoff})
    conn.commit()
    print(f"Deleted {result.rowcount} BGP records older than {cutoff}")