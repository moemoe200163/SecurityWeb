# SecurityWeb Backend 開發指南

## 技術棧

- **框架**: Fastify + TypeScript
- **ORM**: Prisma
- **數據庫**: PostgreSQL
- **AI**: MiniMax API

## API 路由

| 前綴 | 功能 |
|------|------|
| `/api/soc` | SOC 分析 |
| `/api/threat` |威脅情報 |
| `/api/pentest` | 滲透測試 |
| `/api/ip` | IP 信譽 |
| `/api/bgp` | BGP 監控 |
| `/api/report` | 報告生成 |

## 數據庫優化

### Phase 1: In-Memory Cache (已實作)

- Session 查詢結果快取
- 熱門 IP 查詢結果快取
- 使用 node-cache 或 Map

### Phase 2: Redis 導入條件

- IP/域名查詢 QPS 超過 1000
- 需要多 backend 實例共享緩存
- 需要 Rate Limiting、Session Store、Pub/Sub
- 黑名單資料超過 10 萬筆

### PostgreSQL 配置

優化後的 docker-compose.yml 配置：
```yaml
command:
  - -c shared_buffers=384MB
  - -c max_connections=40
  - -c work_mem=10MB
  - -c maintenance_work_mem=256MB
  - -c effective_cache_size=1GB
  - -c shared_preload_libraries=pg_stat_statements
```

## 快取策略

### Session Cache
- 使用 Map<string, SessionData> 儲存
- TTL: 5 分鐘
- 失效條件: 收到新訊息時

### IP Reputation Cache
- 熱門 IP (top 100) 常駐
- 查詢結果 TTL: 1 分鐘
- 失效條件: 收到新報告時

### BGP Cache
- ASN 查詢結果 TTL: 5 分鐘
- 前綴統計 TTL: 1 分鐘

## 常見問題

### Q: 如何分析慢查詢？
```sql
-- 啟用 pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 查看最慢的查詢
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Q: 如何優化 Prisma 連接？
```typescript
// prisma/client.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});
```

## 腳本工具

| 腳本 | 功能 |
|------|------|
| `bgp-consumer.py` | RIPE RIS WebSocket 消費者 |
| `sync-bgp-asn.py` | 同步 AS 資訊 |
| `cleanup-bgp.py` | 清理 24 小時前 BGP 記錄 |
| `enrichBlacklist.py` | 黑名單 enrichment |