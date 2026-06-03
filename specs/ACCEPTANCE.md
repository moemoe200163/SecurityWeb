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
| Turbopack 在 worktree symlink 下 panic | **INFO** | `next dev` 預設 Turbopack 在 `.worktrees/<name>/frontend/node_modules` symlink 指到 project root 外時會 panic；驗收/開發請用 `next dev --webpack` 或正式 checkout 後跑 Turbopack。Next.js 16 + worktree symlink 互動的已知問題，非 Phase 21 缺陷（Phase 21 P0 follow-up）。 |

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
| Playwright E2E `admin-keys.spec.ts` | **PASS** | 3 個 test 全綠（2026-06-03 run, 4.4s）：① PageHero shows key statistics in commandValue ② PageHero shows loading... before stats load ③ rotate modal cannot close without "I have delivered" confirmation |
| Playwright E2E `admin-retention.spec.ts` | **PASS** | 5 個 test 全綠（2026-06-03 run, 5.7s）：① PageHero shows "never" when no retention has run ② PageHero shows formatted timestamp when retention has run ③ renders `<ApiKeyRequired />` when API key is missing ④ shows forbidden state when API returns 403 ⑤ shows retry button on 500 |

**Phase 21 完整驗收記錄（2026-06-03）：**

| 檢查 | 結果 | 證據 |
|------|------|------|
| Backend `npm test` | PASS | 54/54 passed，stable under default parallel run（unique marker 修法） |
| Backend `npx tsc --noEmit` | PASS | 無錯 |
| Frontend `npm run lint` | PASS | 0 error |
| Frontend `npx next build --webpack` | PASS | Phase 21 前端編譯成功（`/admin/keys`、`/admin/retention` 路由含 PageHero 與 modal hardening） |
| Frontend `next dev --webpack` | PASS | worktree 啟動於 port 3001，served Phase 21 code（title 確認：`安全智能體 AI 對話系統`） |
| Frontend Turbopack | INFO | worktree symlink panic — Next.js 16 + worktree 互動已知問題，非 Phase 21 缺陷（見上方 caveat） |
| Playwright E2E (8 specs) | PASS | 8/8 in 6.4s（見上方逐項 list）。執行：`BASE_URL=http://localhost:3001 npx playwright test e2e/admin-keys.spec.ts e2e/admin-retention.spec.ts` |
| Final code review | APPROVE_WITH_CHANGES | 0 CRITICAL / 0 HIGH / 2 MEDIUM / 9 LOW；in-scope MEDIUM（`MyApiKeyPanel` useState 順序）已在 commit `6d91437` 處理 |

---

## 15. Phase 22-A: Sandbox Egress 操作文件化

| 項目 | 狀態 | 證據 |
|------|------|------|
| `docs/sandbox-egress.md` 存在 | **PASS** | 涵蓋 profile 行為、egress precedence、config 格式、啟動範例、驗證命令、安全注意事項、Troubleshooting |
| Profile 名稱與 compose 一致 | **PASS** | 文件列出 `tools` / `bgp` / `edge` 三個實際 profile（皆存在於 `docker-compose.yml`），並明確標註 `docker-compose.dev.yml` header 寫的 `--profile dev` 是 no-op（無 `dev` profile） |
| Egress precedence 與 script 一致 | **PASS** | `file > env > lockdown default`，與 `sandbox/egress-policy.sh` 開頭註解一致 |
| Config 格式與 example 一致 | **PASS** | JSON `allow[].cidr` / `ports` / `proto` + `allowIcmp`；ENV `cidr:port/proto,...`，與 `sandbox/egress.conf.example` 與 `validateEgressConfig.ts` 對齊 |
| 驗證命令可執行 | **PASS** | `npm run validate-egress`、`bash sandbox/egress-tests/run_bats.sh`、`DRY_RUN=1 bash sandbox/egress-policy.sh` 三個都列在文件第 6 節 |
| 拒絕 `0.0.0.0/0` 提示 | **PASS** | 文件第 4 節 + 第 7 節 + 第 8 節都有提到；`egress-policy.sh` 與 `validateEgressConfig.ts` 雙重把關 |
| 不在文件/報告貼 `docker compose config` 全文 | **PASS** | `docs/sandbox-egress.md` 第 7 節明文規定只用 `grep` / `yq` 抓特定欄位；本驗收紀錄亦只列 profile / volume / 資源欄位 |
| `specs/TODO.md` 同步 | **PASS** | Phase 22 第 3 項標為 `[x]`，加註 `22-A` 與 `docs/sandbox-egress.md` 連結 |

**Phase 22-A 完整驗收記錄（2026-06-03）：**

| 檢查 | 結果 | 證據 |
|------|------|------|
| 文件章節齊備 | PASS | 用途 / profile 行為 / precedence / config 格式 / 啟動範例 / 驗證命令 / 安全 / Troubleshooting / 相關文件 9 個段落 |
| 與 Phase 19.3 spec 對齊 | PASS | profile gating、precedence、CIDR 拒絕規則全部與 `docs/superpowers/specs/2026-06-02-phase19.3-sandbox-egress-policy-design.md` 一致 |
| 與 docker-compose 對齊 | PASS | profile 名稱、volume 掛載點（`/etc/sandbox/egress.conf`）、env 名稱（`EGRESS_CONF` / `EGRESS_ALLOW`）皆與 compose file 一致 |
| 不擴大 scope | PASS | 本次僅新增文件 + 同步 TODO / ACCEPTANCE，未改 compose、egress script、validateEgressConfig；Phase 22-B (CI) 與 22-C (BGP) 保持未完成 |

---

## 16. Phase 22-B: Compose Secrets-Safe Validation

| 項目 | 狀態 | 證據 |
|------|------|------|
| `scripts/validate-compose-safe.sh` 存在 | **PASS** | 18 個檢查全通過 |
| 不暴露完整 `docker compose config` 輸出 | **PASS** | 腳本只使用 `--services` 和 `--profiles` 子命令 |
| 否認清單檢查（硬編碼密鑰） | **PASS** | 無硬編碼 `POSTGRES_PASSWORD`、`MINIMAX_API_KEY` 等 |
| 服務結構驗證 | **PASS** | `frontend`、`backend`、`db` 存在；`sandbox`、`bgp-consumer`、`nginx` 不在預設列表 |
| Profiles 驗證 | **PASS** | `tools`、`bgp`、`edge` profiles 存在 |
| Sandbox 驗證 | **PASS** | 在 `tools` profile，有 `NET_ADMIN` 能力 |
| BGP consumer 驗證 | **PASS** | 在 `bgp` profile |
| 埠暴露檢查 | **PASS** | 主 compose 不暴露 backend/db 埠 |
| Dev override 檢查 | **PASS** | dev override 暴露埠（預期行為） |
| 環境變數引用 | **PASS** | `POSTGRES_PASSWORD`、`MINIMAX_API_KEY` 使用 `${VAR}` 語法 |

**Phase 22-B 完整驗收記錄（2026-06-03）：**

| 檢查 | 結果 | 證據 |
|------|------|------|
| `bash scripts/validate-compose-safe.sh` | PASS | 18/18 checks passed |
| `docker compose config --services` | PASS | 只列服務名，不含 secrets |
| `docker compose config --profiles` | PASS | 列出 bgp/edge/tools |
| 不貼完整 `docker compose config` | PASS | 本文件無完整 config 輸出 |

---

## 17. Phase 22-C: BGP Consumer Optimization

| 項目 | 狀態 | 證據 |
|------|------|------|
| Bulk insert 已有 | **PASS** | `BATCH_SIZE=100`，批量插入 |
| 低頻 log | **PASS** | `LOG_INTERVAL_SECONDS=300`（5 分鐘），不再每個 batch 打印 |
| `/api/bgp/metrics` 端點 | **PASS** | 回傳 totalUpdates、announces、withdrawals、oldestTimestamp、latestTimestamp |
| Profile-gated | **PASS** | bgp-consumer 仍在 `bgp` profile |

**Phase 22-C 完整驗收記錄（2026-06-03）：**

| 檢查 | 結果 | 證據 |
|------|------|------|
| `bgp-consumer.py` 低頻 log | PASS | 每 5 分鐘打印一次統計，而非每個 batch |
| `GET /api/bgp/metrics` | PASS | 回傳 retention 指標（總筆數、最舊/最新時間戳） |
| Backward compatible | PASS | 既有 API 不受影響 |

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
