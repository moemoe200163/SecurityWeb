#!/usr/bin/env python3
"""
BGP Consumer Wrapper - 控制執行時段
北京時間 00:00-06:00 = UTC 16:00-22:00
只在允許時段內執行 bgp-consumer.py
"""

import subprocess
import time
import os
from datetime import datetime

# UTC 時段：16:00-22:00 (北京 00:00-06:00)
ALLOWED_HOURS_UTC = [16, 17, 18, 19, 20, 21]

def is_allowed_time():
    """檢查現在是否在允許時段內"""
    utc_hour = datetime.utcnow().hour
    return utc_hour in ALLOWED_HOURS_UTC

def run_consumer():
    """執行 bgp-consumer"""
    print(f"[{datetime.utcnow().isoformat()}] Starting bgp-consumer.py...")
    env = os.environ.copy()
    proc = subprocess.Popen(
        ["python", "bgp-consumer.py"],
        cwd="/app",
        env=env
    )
    return proc

def main():
    print("BGP Consumer Wrapper started")
    print(f"Allowed UTC hours: {ALLOWED_HOURS_UTC} (Beijing 00:00-06:00)")
    print(f"Current UTC hour: {datetime.utcnow().hour}")

    consumer_proc = None

    while True:
        if is_allowed_time():
            if consumer_proc is None or consumer_proc.poll() is not None:
                print(f"[{datetime.utcnow().isoformat()}] Starting consumer (in allowed window)...")
                consumer_proc = run_consumer()
        else:
            if consumer_proc is not None and consumer_proc.poll() is None:
                print(f"[{datetime.utcnow().isoformat()}] Stopping consumer (outside allowed window)...")
                consumer_proc.terminate()
                consumer_proc.wait()
                consumer_proc = None

        time.sleep(60)  # 每分鐘檢查一次

if __name__ == "__main__":
    main()
