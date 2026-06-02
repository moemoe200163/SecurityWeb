# ACCEPTANCE.md - 安全智能體 AI 對話網站

## 驗收狀態圖例
- `PASS` 通過
- `FAIL` 未通過（標記原因）
- `PARTIAL` 部分通過
- `BLOCKED` 阻塞（標記原因）
- `NOT TESTED` 尚未測試

> **重要**：所有 `PASS` 都必須有對應的指令輸出佐證。
> 改動後請同步更新本檔。

---

## 1. 基礎建設

### DB 與 Migration
| 項目 | 狀態 | 證據 |
|------|------|------|
| Prisma schema 與實際 DB 一致 | **PASS** | `prisma migrate deploy` 成功套用 3 個 migration，17 張表全部存在 |
| Migration history 與 schema 一致 | **PASS** | `_prisma_migrations` 與 `prisma/migrations/` 對齊 |
| 沒有 orphan rows 阻擋 relation query | **PASS** | 改用 optional relation（`ToolExecution.template` / `AuditLog.user`）讓 schema 與 DB 對齊 |

### Backend Build / Test
| 項目 | 狀態 | 證據 |
|------|------|------|
| `npm run build` 通過 | **PASS** | tsc 無錯 |
| `npx vitest run tests/api.test.ts` 全綠 | **PASS** | 23/23 passed |
| 測試用 API key 不再硬編碼 | **PASS** | `tests/setup.ts` 用 `TEST_API_KEY` 注入 |
| 測試檔沒有 fake summary | **PASS** | 移除 `17 passed` 假宣告 |
| 測試有真實斷言（包含 RBAC、disabled template、404） | **PASS** | 23 個 case 覆蓋 5 大區塊 |

### Frontend Build / Lint
| 項目 | 狀態 | 證據 |
|------|------|------|
| `npm run build` 通過 | **PASS** | Next.js 16 編譯成功 |
| `npm run lint` 0 error | **PASS** | 仍有 ~60 warnings（見 P3 改進中） |
| Lint warning 數量下降 | **PARTIAL** | baseline 66 → after P3（TBD） |

---

## 2. 受保護 API 與 RBAC

| 項目 | 狀態 | 證據 |
|------|------|------|
| 缺少 X-API-Key 回 401 | **PASS** | `curl /api/alerts` 無 key 回 401 |
| 不存在的 X-API-Key 回 401 | **PASS** | apiKeyAuth middleware 拒絕 |
| 受保護路由改用共用 client | **PASS** | `frontend/src/lib/api.ts` 的 `api.tools` / `api.alerts` / `api.dashboard`；`tools/page.tsx` 與 `alerts/page.tsx` 已改用 |
| 共用 client 有 normalized error | **PASS** | `ApiError` class，含 status / details |
| 共用 client 有 X-API-Key 自動注入 | **PASS** | `requireAuth: true` 觸發 `getApiKey()` |

---

## 3. 工具執行安全

| 項目 | 狀態 | 證據 |
|------|------|------|
| Disabled template 不能執行 | **PASS** | `sql_dump` 回 400 + 「disabled」訊息 |
| Unapproved template 不能執行 | **PASS** | `definitely_not_a_real_template` 回 400 |
| 缺少 required params 被拒 | **PASS** | `nmap_basic` 缺 `target` 回 400 |
| 帶未允許的 param 被拒 | **PASS** | `extra_evil_flag` 回 400 |
| 執行路徑使用 validated command | **PASS** | `tools.ts` 改用 `executor.executeDirect(validation.command)` |
| `holehe_email` 對應到正確 tool | **PASS** | 移除 `nmap_scan` fallback；`WhitelistValidator` 透過 `command_template` 對應 |
| 沙箱內執行 | **PASS** | `SandboxManager` + `ToolExecutor` |

---

## 4. 告警與調查流程

| 項目 | 狀態 | 證據 |
|------|------|------|
| 列表 / 查詢 / 匯入 / 狀態 / 反饋 | **PASS** | 23 個測試覆蓋 |
| 調查流程建立**真實** Session（不再是 alertId 充當 sessionId） | **PASS** | `prisma.session.create` + `alert.update({ sessionId: session.id })` |
| 調查對不存在的 alertId 回 404 | **PASS** | 測試覆蓋 |
| 審計日誌記錄 investigation | **PASS** | `auditLog.create` with `details.sessionId` |

---

## 5. Dashboard

| 項目 | 狀態 | 證據 |
|------|------|------|
| `GET /api/dashboard/stats` 回 200 | **PASS** | 23 個測試通過；`metrics.alerts` / `metrics.tools` 存在 |
| `GET /api/dashboard/stats/timeline` 回 200 | **PASS** | timeline 結構正確 |
| 報告匯出 | **PASS** | `GET /api/dashboard/report/:alertId` |

---

## 6. Docker / 本地開發

| 項目 | 狀態 | 證據 |
|------|------|------|
| `docker compose up` 啟動 frontend + backend + db | **PASS** | 三個容器 healthy |
| 預設啟動路徑只包含必要服務 | **PARTIAL** | 已加 backend port 暴露；sandbox/nginx/bgp 需 profile 化（見 P4） |
| `npm run db:seed` 可重複執行 | **PASS** | 使用 `upsert` 與 `randomUUID` |
| 後端可被 host 訪問 | **PASS** | `localhost:4000` 對應 backend |

---

## 7. 尚未驗收（NOT TESTED / BLOCKED）

- 沙箱實際執行工具（需要 Kali image 在 host 上啟動 docker-in-docker，尚未在 CI 跑）
- AI 對話生成（需要 OLLAMA 或 MiniMax API key 才有真實回應；mock 模式只回固定模板）
- BGP consumer 持續運作（需 RIPEstat 或公開 feed 連線；測試環境不跑）
- 生產環境的密鑰管理（目前 .env 直接 commit 進版本庫，需要改用 secret manager）
- CSRF / 速率限制（後端目前未實作）
- 完整 E2E（含前端互動，需要 Playwright 環境）
- 完整 i18n 切換（目前只有繁中）
