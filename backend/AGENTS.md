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

## 路由認證矩陣（P0.2 完成，2026-06-04）

> P0.2 已完成：8 條裸奔路由全部補上 `apiKeyAuth + requireUser`，昂貴端點加 `rateLimit`。
> `settings` 路由留待下一批（POST `/ai` 可改 AI provider，建議改 `requireAdmin`）。

| 路由前綴 | 端點 | `apiKeyAuth` | `requireUser` | `requireAdmin` | `rateLimit` | 備註 |
|---------|------|-------------|--------------|---------------|------------|------|
| `/api/soc` | POST `/analyze` | ✅ | ✅ | — | 10/min | P0.2a |
| `/api/soc` | POST `/sessions/:id/messages` | ✅ | ✅ | — | 30/min | P0.2a |
| `/api/soc` | GET `/sessions`, `/sessions/:id`, `/sessions/:id/report` | ✅ | ✅ | — | — | P0.2a |
| `/api/threat` | POST `/investigate` | ✅ | ✅ | — | 10/min | P0.2b |
| `/api/threat` | POST `/sessions/:id/messages` | ✅ | ✅ | — | 30/min | P0.2b |
| `/api/threat` | GET `/sessions`, `/sessions/:id` | ✅ | ✅ | — | — | P0.2b |
| `/api/pentest` | POST `/assist` | ✅ | ✅ | — | 3/min | P0.2c（sandbox 昂貴） |
| `/api/pentest` | POST `/sessions/:id/messages` | ✅ | ✅ | — | 30/min | P0.2c |
| `/api/pentest` | GET `/templates`, `/sessions`, `/sessions/:id` | ✅ | ✅ | — | — | P0.2c |
| `/api/bgp` | GET `/query` | ✅ | ✅ | — | 30/min | P0.2d |
| `/api/bgp` | GET `/stats`, `/whois/:asn`, `/prefixes/:asn`, `/lookup`, `/metrics` | ✅ | ✅ | — | — | P0.2d |
| `/api/urlhaus` | GET `/check`, `/recent` | ✅ | ✅ | — | — | P0.2d |
| `/api/otx` | GET `/check`, `/pulse/:pulseId`, `/search` | ✅ | ✅ | — | — | P0.2d |
| `/api/ip` | GET `/check`, `/history`, `/stats`, `/blacklist`, `/quota` | ✅ | ✅ | — | — | P0.2d |
| `/api/report` | GET `/:sessionId/pdf`, `/:sessionId/json` | ✅ | ✅ | — | — | P0.2d |
| `/api/settings` | GET `/ai`, POST `/ai`, POST `/ai/test` | ❌ | — | — | 部分（`/ai/test` 5/min） | **下一批**：POST `/ai` 可改 AI provider，建議改 `requireAdmin` |
| `/api/alerts` | * | ✅ | ✅ | — | — | 已受保護 |
| `/api/sessions` (evidence) | * | ✅ | ✅ | — | — | 已受保護 |
| `/api/dashboard` | * | ✅ | ✅ | — | — | 已受保護 |
| `/api/tools` | * | ✅ | ✅ | — | — | 已受保護 |
| `/api/me` | * | ✅ | ✅ | — | — | 已受保護 |
| `/api/admin` | * | ✅ | — | ✅ | — | 已受保護 |
| `/api/admin` (keys) | * | ✅ | — | ✅ | — | 已受保護 |
| `/api/admin` (retention) | * | ✅ | — | ✅ | — | 已受保護 |
| `/health` | * | — | — | — | — | 公開健康檢查 |

**現況總結**：P0.2 完成，16 條路由前綴中 **15 條已受保護**，僅 `settings` 留待下一批。測試覆蓋：`soc.test.ts` (6) + `threat.test.ts` (5) + `pentest.test.ts` (5) + `externalApis.test.ts` (11) = **27 條新測試**，全量 81/81 通過。

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