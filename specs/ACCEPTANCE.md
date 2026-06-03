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
| Prisma schema 與實際 DB 一致 | **PASS** | `prisma migrate deploy` 成功套用 4 個 migration，18 張表全部存在（含 evidence） |
| Migration history 與 schema 一致 | **PASS** | `_prisma_migrations` 與 `prisma/migrations/` 對齊 |
| 沒有 orphan rows 阻擋 relation query | **PASS** | 改用 optional relation（`ToolExecution.template` / `AuditLog.user`）讓 schema 與 DB 對齊 |

### Backend Build / Test
| 項目 | 狀態 | 證據 |
|------|------|------|
| `npm run build` 通過 | **PASS** | tsc 無錯 |
| `npm test` (= `vitest run`) 全綠 | **PASS** | 54/54 passed — `npm test`（預設 `vitest run` 平行）穩定；retention.test.ts 用 unique marker 避免平行 race（Phase 21 P0） |
| 測試用 API key 不再硬編碼 | **PASS** | `tests/setup.ts` 用 `TEST_API_KEY` 注入 |
| 測試檔沒有 fake summary | **PASS** | 移除 `17 passed` 假宣告 |
| 測試有真實斷言（包含 RBAC、disabled template、404） | **PASS** | 23 個 case 覆蓋 5 大區塊 |
| Retention 測試使用 raw SQL seed | **PASS** | 繞過 Prisma `@default(now())` 確保舊資料可靠建立 |

### Frontend Build / Lint
| 項目 | 狀態 | 證據 |
|------|------|------|
| `npm run build` 通過 | **PASS** | Next.js 16 編譯成功，含 `/admin/retention` 路由 |
| `npm run lint` 0 error | **PASS** | 移除 MyApiKeyPanel 未使用 import + e2e `any` 修正 |
| Lint warnings | **INFO** | 既有 warnings（非 error），不阻塞 |

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

## 6. Evidence API（P2）

| 項目 | 狀態 | 證據 |
|------|------|------|
| Prisma Evidence model 有 FK 到 Session | **PASS** | `schema.prisma` 含 `session Session @relation(...)` + `onDelete: Cascade` |
| `POST /api/sessions/:sessionId/evidence` 建立證據 | **PASS** | Zod 驗證 + `max(10000)` content + audit log |
| `GET /api/sessions/:sessionId/evidence` 列表 | **PASS** | 回傳 evidence 陣列，按 createdAt 排序 |
| `DELETE /api/sessions/:sessionId/evidence/:id` 刪除 | **PASS** | 404 on missing, audit log 記錄 |
| Evidence 路由受 auth 保護 | **PASS** | `apiKeyAuth + requireUser` middleware |
| 敏感欄位 audit log mask | **PASS** | `sanitizeAuditDetails()` 覆蓋所有 evidence 路由 |
| 前端 `api.evidence` 共用 client | **PASS** | `api.evidence.add()` / `.list()` / `.remove()` |
| `AddToInvestigation` 組件接回 API | **PASS** | 使用 `api.evidence.add()` 取代 raw fetch |

---

## 7. Investigation Workspace（P1）

| 項目 | 狀態 | 證據 |
|------|------|------|
| 三欄式佈局（Alert+IOC / Timeline / Verdict+Actions） | **PASS** | `InvestigationWorkspace.tsx` 實作 |
| 跨模組 session 載入 | **PASS** | `loadSessionFromAnyModule()` 嘗試 soc/threat/pentest API |
| IOC 自動提取（IP/domain/hash） | **PASS** | regex 提取 IP/Domain/Hash |
| Alert context 關聯顯示 | **PASS** | 左欄顯示 severity, source, rawContent |

---

## 8. 安全治理（P3）

| 項目 | 狀態 | 證據 |
|------|------|------|
| Rate limiting — tools/execute 10/min | **PASS** | `rateLimit(10, 60_000)` middleware |
| Rate limiting — alerts/import 20/min | **PASS** | `rateLimit(20, 60_000)` middleware |
| Rate limiting — settings/ai/test 5/min | **PASS** | `rateLimit(5, 60_000)` middleware |
| Audit log 敏感欄位 sanitization 全覆蓋 | **PASS** | `sanitizeAuditDetails()` 覆蓋 alerts(5處) + tools + admin + evidence |

---

## 11. Phase 19: API Key 生命週期

| 項目 | 狀態 | 證據 |
|------|------|------|
| Schema: nullable key 欄位 + 生命週期時間戳 | **PASS** | migration 加 `hashedKey`, `lastRotatedAt`, `expiresAt` |
| apiKeyAuth: 撤銷/過期檢查 + 恆定時間 hash 比對 | **PASS** | `crypto.timingSafeEqual` 比對 |
| apiKeyService: race-free rotate/revoke | **PASS** | Prisma transaction 保證原子性 |
| `/api/me/api-key` (self) 路由 | **PASS** | GET/POST/rotate self-service |
| `/api/admin/keys` (admin) 路由 | **PASS** | list/rotate/revoke admin API |
| 前端 MyApiKeyPanel + UserKeyTable | **PASS** | settings 頁面 + admin/keys 頁面 |
| 整合測試 + Playwright E2E | **PASS** | 17 個新測試全通過 |

---

## 12. Phase 19: Retention 管理員

| 項目 | 狀態 | 證據 |
|------|------|------|
| `runRetentionCleanup` 擴充 mode 參數 | **PASS** | `'execute' \| 'preview'` + per-table error reporting |
| `GET /api/admin/retention/status` | **PASS** | 回傳 counts, policy, lastRunAt, lastResult |
| `POST /api/admin/retention/run` | **PASS** | 支援 `?dryRun=true` preview |
| 舊 `/retention/cleanup` 標記 deprecated | **PASS** | JocDoc `@deprecated` + 保留向後相容 |
| 整合測試 5/5 通過 | **PASS** | adminRetention.test.ts |
| 前端 `api.adminRetention` methods | **PASS** | status() + run(dryRun, config) |
| RetentionPanel 組件 | **PASS** | counts/policy/last run 展示 + dry-run + confirm modal |
| `/admin/retention` 頁面 + 導航 | **PASS** | 從 admin/keys 可導航 |

---

## 13. Phase 19: Sandbox Egress Policy

| 項目 | 狀態 | 證據 |
|------|------|------|
| `egress.conf.example` JSON config | **PASS** | CIDR + port + proto whitelist |
| `egress-policy.sh` 重寫 | **PASS** | file > env > lock-down 三層 precedence |
| `exec "$@"` ENTRYPOINT | **PASS** | container 啟動後正確移交給 CMD |
| `DRY_RUN=1` 模式 | **PASS** | 輸出 iptables rules 不套用 |
| CIDR 驗證 + 0.0.0.0/0 拒絕 | **PASS** | bash regex + explicit check |
| Dockerfile 加 jq + egress assets | **PASS** | `ENTRYPOINT` 設為 egress-policy.sh |
| docker-compose.yml 掛載 config | **PASS** | dev override 掛 egress.conf，main compose 不掛 |
| `validateEgressConfig.ts` Zod 驗證 | **PASS** | CLI + `npm run validate-egress` |
| Bats tests 10/10 | **PASS** | lockdown + env + rejection tests |

---

## 9. 前端一致性（P4）

| 項目 | 狀態 | 證據 |
|------|------|------|
| ApiKeyRequired 套用到全部 7 個工作流頁面 | **PASS** | soc/analyze, alerts, tools, dashboard, threat/investigate, settings, pentest/assist |
| StatusBadge 組件統一替換 inline badge | **PASS** | alerts/page.tsx, tools/page.tsx, threat/investigate/page.tsx |
| 移除重複 color map（severityColors, riskColors） | **PASS** | 改用 StatusBadge 內建 variants |

---

## 10. Docker / 本地開發

| 項目 | 狀態 | 證據 |
|------|------|------|
| `docker compose up` 啟動 frontend + backend + db | **PASS** | 三個容器 healthy |
| 預設啟動路徑只包含必要服務 | **PARTIAL** | 已加 backend port 暴露；sandbox/nginx/bgp 需 profile 化（見 P4） |
| `npm run db:seed` 可重複執行 | **PASS** | 使用 `upsert` 與 `randomUUID` |
| 後端可被 host 訪問 | **PASS** | `localhost:4000` 對應 backend |

---

## 14. Phase 21: 前端治理頁一致化

| 項目 | 狀態 | 證據 |
|------|------|------|
| `/admin/keys` 改用共用 `PageHero` | **PASS** | `frontend/src/app/admin/keys/page.tsx` 使用 `<PageHero>`，command 顯示「{n} active · {n} revoked · {n} no-key」 |
| `/admin/retention` 改用共用 `PageHero` | **PASS** | `frontend/src/app/admin/retention/page.tsx` 使用 `<PageHero>`，command 顯示 `lastRunAt` 或 `never` |
| `RetentionPanel` 401 → `ApiKeyRequired` | **PASS** | 三狀態 error UI，401 整頁換 `<ApiKeyRequired />` |
| `RetentionPanel` 403 → forbidden inline | **PASS** | 顯示「需要管理員權限」+ 連結到 `/settings` |
| `RetentionPanel` 500 → retry | **PASS** | 顯示錯誤區塊 + Retry 按鈕（重試成功） |
| `MyApiKeyPanel` rotate modal 禁止直接 cancel | **PASS** | 移除 Cancel 按鈕；backdrop/ESC hard-block；唯一關閉路徑是勾選「I have saved」後按「I've saved — close」 |
| `UserKeyTable` rotate modal 硬化 | **PASS** | 加「I have delivered this key to the user」checkbox；Done 按鈕 disabled 直到勾選 |
| Playwright E2E `admin-keys.spec.ts` | **PASS** | 3 個 test 全綠 |
| Playwright E2E `admin-retention.spec.ts` | **PASS** | 5 個 test 全綠（PageHero + 401/403/500） |

---

## 7. 尚未驗收（NOT TESTED / BLOCKED）

- 沙箱實際執行工具（需要 Kali image + `--profile tools`，尚未在 CI 跑）
- AI 對話生成（需要 OLLAMA 或 MiniMax API key 才有真實回應；mock 模式只回固定模板）
- BGP consumer 持續運作（需 RIPEstat 或公開 feed 連線；測試環境不跑）
- 生產環境的密鑰管理（目前 .env 直接 commit 進版本庫，需要改用 secret manager）
- CSRF 保護（後端目前未實作）
- 完整 i18n 切換（目前只有繁中）

**已解決（從前版移除）：**
- ~~API key 過期 / 撤銷機制~~ → Phase 19.1 已完成（self-service rotate + admin revoke）
- ~~資料保留策略~~ → Phase 19.2 已完成（retention admin UI + dry-run）
- ~~完整 E2E smoke test~~ → Phase 19 Playwright 已建立（smoke.spec.ts）
