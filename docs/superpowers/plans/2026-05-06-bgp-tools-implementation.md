# BGP Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 BGP Tools 功能，支援查詢最近 24 小時的 BGP 路由歷史資料

**Architecture:**
- 後端：新增 `/api/bgp` 路由，提供 BGP 查詢和統計 API
- 前端：在 `/threat/bgp` 新增 BGP 查詢頁面
- 即時資料：Python consumer 串接 RIPE RIS Live WebSocket，寫入 PostgreSQL
- 輔助資料：Python script 同步 bgp.tools dumps 到本地資料庫

**Tech Stack:** Fastify, Next.js, Prisma, PostgreSQL, Python, RIPE RIS Live API, bgp.tools

---

## Task Structure

### Task 6: 新增 BGP 資料表 Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末新增 BGP 資料表**

```prisma
// BGP 即時更新記錄（最近 24 小時）
model BgpUpdate {
  id        BigInt    @id @default(autoincrement())
  prefix    String    @db.Cidr          // IP prefix (e.g., "192.168.1.0/24")
  asPath    String?   @db.Text           // AS 路徑 (e.g., "12345 67890 54321")
  peerAsn   BigInt?                       // 對等 AS 號碼
  originAsn BigInt?                       // 起源 AS 號碼
  timestamp DateTime  @default(now())      // BGP update 時間
  type      String    @default("A")      // A=Announce, W=Withdraw
  source    String?                       // RIPE RIS collector 名稱
  country   String?                       // AS 國家

  @@index([prefix])
  @@index([originAsn])
  @@index([timestamp])
  @@index([timestamp, prefix])
}

// AS 資訊資料表（從 bgp.tools 同步）
model BgpAsnInfo {
  asn       BigInt    @id
  name      String?
  country   String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([asn])
}
```

- [ ] **Step 2: 執行 Prisma migrate**

Run: `cd backend && npx prisma migrate dev --name add_bgp_tables`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add BgpUpdate and BgpAsnInfo tables"
```

---

### Task 7: 新增 BGP 後端 API 路由

**Files:**
- Create: `backend/src/routes/bgp.ts`
- Modify: `backend/src/index.ts` (register route)

- [ ] **Step 1: 建立 backend/src/routes/bgp.ts**

```typescript
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';

export async function bgpRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/bgp/query - 查詢 BGP 更新記錄
  fastify.get('/query', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const prefix = query.prefix;
    const asn = query.asn ? BigInt(query.asn) : undefined;
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 50, 100);
    const startTime = query.start_time ? new Date(query.start_time) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: any = {
      timestamp: { gte: startTime }
    };
    if (prefix) {
      where.prefix = { contains: prefix };
    }
    if (asn) {
      where.originAsn = asn;
    }

    const [total, records] = await Promise.all([
      prisma.bgpUpdate.count({ where }),
      prisma.bgpUpdate.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
    ]);

    return reply.send({
      data: records.map(r => ({
        id: r.id.toString(),
        prefix: r.prefix,
        asPath: r.asPath,
        peerAsn: r.peerAsn?.toString(),
        originAsn: r.originAsn?.toString(),
        timestamp: r.timestamp,
        type: r.type,
        source: r.source,
        country: r.country,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /api/bgp/stats - 取得統計資料
  fastify.get('/stats', async (request, reply) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, announces, withdraws, uniquePrefixes, uniqueAsns] = await Promise.all([
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since } } }),
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since }, type: 'A' } }),
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since }, type: 'W' } }),
      prisma.bgpUpdate.groupBy({
        by: ['prefix'],
        where: { timestamp: { gte: since } },
        _count: true,
      }),
      prisma.bgpUpdate.groupBy({
        by: ['originAsn'],
        where: { timestamp: { gte: since }, originAsn: { not: null } },
      }),
    ]);

    return reply.send({
      totalUpdates: total,
      announces,
      withdraws,
      uniquePrefixes: uniquePrefixes.length,
      uniqueAsns: uniqueAsns.length,
      since: since.toISOString(),
    });
  });
}
```

- [ ] **Step 2: 在 backend/src/index.ts 註冊路由**

在 imports 之後新增：
```typescript
import { bgpRoutes } from './routes/bgp.js';
```

在 fastify.register 之後新增：
```typescript
fastify.register(bgpRoutes, { prefix: '/api/bgp' });
```

- [ ] **Step 3: 測試 API**

Run: `curl "http://localhost:4000/api/bgp/stats"`
Expected: JSON with stats

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/bgp.ts backend/src/index.ts
git commit -m "feat: add BGP query and stats API endpoints"
```

---

### Task 8: 新增前端 BGP API client

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 在 api.ts 新增 BGP types 和 methods**

在 `IpReputationStats` interface 之後新增：

```typescript
export interface BgpUpdate {
  id: string;
  prefix: string;
  asPath: string | null;
  peerAsn: string | null;
  originAsn: string | null;
  timestamp: string;
  type: 'A' | 'W';
  source: string | null;
  country: string | null;
}

export interface BgpQueryResult {
  data: BgpUpdate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BgpStats {
  totalUpdates: number;
  announces: number;
  withdraws: number;
  uniquePrefixes: number;
  uniqueAsns: number;
  since: string;
}
```

在 `ip` section 之後新增：

```typescript
  // BGP
  bgp: {
    async query(params: {
      prefix?: string;
      asn?: string;
      page?: number;
      limit?: number;
      start_time?: string;
    }): Promise<BgpQueryResult> {
      const query = new URLSearchParams();
      if (params.prefix) query.set('prefix', params.prefix);
      if (params.asn) query.set('asn', params.asn);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.start_time) query.set('start_time', params.start_time);
      return request(`/api/bgp/query?${query}`);
    },
    async stats(): Promise<BgpStats> {
      return request('/api/bgp/stats');
    },
  },
```

- [ ] **Step 2: 測試 TypeScript 編譯**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add BGP API client"
```

---

### Task 9: 建立 BGP 前端頁面

**Files:**
- Create: `frontend/src/app/threat/bgp/page.tsx`

- [ ] **Step 1: 建立頁面框架**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type BgpUpdate, type BgpStats } from '@/lib/api';
import { Loader2, Search, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function BgpPage() {
  const [data, setData] = useState<BgpUpdate[]>([]);
  const [stats, setStats] = useState<BgpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState<'prefix' | 'asn'>('prefix');
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit };
      if (searchType === 'prefix' && searchValue) {
        params.prefix = searchValue;
      } else if (searchType === 'asn' && searchValue) {
        params.asn = searchValue;
      }

      const [queryRes, statsRes] = await Promise.all([
        api.bgp.query(params),
        api.bgp.stats()
      ]);

      setData(queryRes.data);
      setStats(statsRes);
      setTotal(queryRes.pagination.total);
      setTotalPages(queryRes.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load BGP data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchType, searchValue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">BGP Tools</h1>
            <p className="text-sm text-gray-500 mt-1">查詢最近 24 小時的 BGP 路由資料</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">總更新數</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUpdates.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">Announce</p>
              <p className="text-2xl font-semibold text-emerald-700">{stats.announces.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">Withdraw</p>
              <p className="text-2xl font-semibold text-red-700">{stats.withdraws.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-blue-600">Prefix 數</p>
              <p className="text-2xl font-semibold text-blue-700">{stats.uniquePrefixes.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <p className="text-sm text-purple-600">AS 數</p>
              <p className="text-2xl font-semibold text-purple-700">{stats.uniqueAsns.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <select
              value={searchType}
              onChange={e => setSearchType(e.target.value as 'prefix' | 'asn')}
              className="border rounded-lg px-4 py-2 bg-white"
            >
              <option value="prefix">Prefix</option>
              <option value="asn">ASN</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                placeholder={searchType === 'prefix' ? '例如: 192.168.1.0/24' : '例如: 15169'}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              查詢
            </button>
          </form>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>沒有找到符合條件的 BGP 記錄</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AS Path</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin ASN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">國家</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(item.timestamp).toLocaleString('zh-TW')}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.type === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {item.type === 'A' ? 'Announce' : 'Withdraw'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">{item.prefix}</td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-500 truncate max-w-xs">{item.asPath || '-'}</td>
                        <td className="px-6 py-4 font-mono text-sm">{item.originAsn || '-'}</td>
                        <td className="px-6 py-4 text-sm">{item.country || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-gray-500">
                  顯示 {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, total)}，共 {total} 筆
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm">第 {currentPage} / {totalPages} 頁</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 Sidebar 導航**

Modify: `frontend/src/components/layout/Sidebar.tsx`

在 Threat 相關項目中加入：
```tsx
<Link href="/threat/bgp" className={...}>
  BGP Tools
</Link>
```

- [ ] **Step 3: 測試頁面**

Run: `curl "http://localhost:3000/threat/bgp"` 或使用瀏覽器開啟

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/threat/bgp/page.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add BGP Tools query page"
```

---

### Task 10: 建立 BGP Consumer 即時接收腳本

**Files:**
- Create: `backend/scripts/bgp-consumer.py`

- [ ] **Step 1: 建立 Python 腳本**

```python
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
```

- [ ] **Step 2: 測試腳本（無 DB 的情況下測試解析）**

Run: `python3 backend/scripts/bgp-consumer.py`
Expected: 連線並接收 BGP updates

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/bgp-consumer.py
git commit -m "feat: add BGP consumer script for RIPE RIS Live"
```

---

### Task 11: 建立 bgp.tools 資料同步腳本

**Files:**
- Create: `backend/scripts/sync-bgp-asn.py`

- [ ] **Step 1: 建立 Python 腳本**

```python
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
```

- [ ] **Step 2: 測試腳本**

Run: `python3 backend/scripts/sync-bgp-asn.py`
Expected: 下載並同步 ASN 資料

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/sync-bgp-asn.py
git commit -m "feat: add bgp.tools ASN sync script"
```

---

### Task 12: 設定 BGP 資料 TTL 自動清理

**Files:**
- Modify: `backend/scripts/bgp-consumer.py` (加入清理機制)

- [ ] **Step 1: 在 bgp-consumer.py 加入自動清理**

在 `parse_bgp_update` 函數之前加入：

```python
def cleanup_old_records():
    """刪除超過 24 小時的記錄"""
    with engine.connect() as conn:
        cutoff = datetime.now() - timedelta(hours=24)
        result = conn.execute(text("""
            DELETE FROM "BgpUpdate" WHERE timestamp < :cutoff
        """), {"cutoff": cutoff})
        print(f"Cleaned up {result.rowcount} old records")

# 每執行 1000 次 insert 就清理一次
CLEANUP_INTERVAL = 1000
_insert_count = 0
```

在 `print(f"Inserted {len(updates)} updates...")` 之後加入：

```python
                        _insert_count += len(updates)
                        if _insert_count >= CLEANUP_INTERVAL:
                            cleanup_old_records()
                            _insert_count = 0
```

- [ ] **Step 2: 也可以建立獨立的 cron job script**

Create: `backend/scripts/cleanup-bgp.py`

```python
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
    print(f"Deleted {result.rowcount} BGP records older than {cutoff}")
```

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/cleanup-bgp.py
git commit -m "feat: add BGP data TTL cleanup script"
```

---

## Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
