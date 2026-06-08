# TODO.md - 安全智能體 AI 對話網站

## 項目概述
建立一個前後端分離的 AI 安全助手系統，用於：
- SOC 告警分析（快速研判、處置建議）
- 威脅情報調查（自動化線索挖掘）
- 滲透測試輔助（步驟引導、報告生成）

## 狀態圖例
- `[x]` 完成
- `[~]` 部分完成 / 進行中
- `[ ]` 未開始
- `[!]` 阻塞中（標記原因）

---

## 已完成階段

### Phase 1: 項目初始化 `[x]`
- [x] 初始化 Next.js 14 前端專案
- [x] 設定 Tailwind + shadcn/ui
- [x] 建立 specs 目錄結構
- [x] 撰寫規格文件

### Phase 2: 前端核心框架 `[x]`
- [x] 建立頁面佈局（Sidebar + MainContent）
- [x] 實作頂部進度條組件（StepProgress）
- [x] 實作步進式卡片組件（StepCard）
- [x] 實作工具調用展示區（ToolCallBlock）
- [x] 建立狀態管理（Zustand stepStore）

### Phase 3: SOC 模組頁面 `[x]`
- [x] 建立 /soc/analyze 頁面
- [x] 實作告警上傳區（AlertUpload）
- [x] 實作 AI 即時對話面板（AIChatPanel）
- [x] 實作分析報告生成（AnalysisReport）

### Phase 4: 威脅情報模組 `[x]`
- [x] 建立 /threat/investigate 頁面
- [x] 實作 IP/Domain/Hash 輸入區
- [x] 實作線索挖掘流程

### Phase 5: 滲透測試模組 `[x]`
- [x] 建立 /pentest/assist 頁面
- [x] 實作目標枚舉步驟
- [x] 實作漏洞驗證流程

### Phase 6: 後端 API 層 `[x]`
- [x] 初始化後端專案
- [x] 設定 Prisma + PostgreSQL
- [x] 實作 AI Bridge 抽象層（OllamaAdapter / MiniMaxAdapter / AIServiceFactory）
- [x] 實作 API 路由

### Phase 7: Docker 部署 `[x]`
- [x] 撰寫前端 Dockerfile
- [x] 撰寫後端 Dockerfile
- [x] 撰寫 docker-compose.yml

### Phase 8: RBAC 與 API Key 認證 `[x]`
- [x] User / API Key 模型（schema + seed）
- [x] `apiKeyAuth` middleware（64-char key）
- [x] `requireRole` / `requireUser` / `requireAdmin` middleware
- [x] 套用到所有受保護路由

### Phase 9: 工具平台（Whitelist） `[x]`
- [x] `ToolTemplate` 與 `ToolExecution` 模型
- [x] `WhitelistValidator`：approved + enabled 雙重檢查
- [x] 必要參數檢查（從 `command_template` 的 `{placeholder}` 推導）
- [x] 允許值檢查（`allowed_params` 值域）
- [x] 沙箱執行 + 審計 log
- [x] 工具歷史 / 單筆查詢 / 列表
- [x] Admin template 管理（enable / disable / approve / 刪除）

### Phase 10: 告警中心 `[x]`
- [x] `Alert` 與 `KnowledgeFeedback` 模型
- [x] 列表 / 查詢 / 匯入（單筆 / 批次）/ 更新狀態 / 反饋
- [x] 調查流程建立真實 Session（不再以 alertId 充當 sessionId）
- [x] Dashboard 統計 + 時間軸 + 報告

### Phase 11: BGP / Docker `[x]`
- [x] `BgpUpdate` / `BgpAsnInfo` 模型
- [x] BGP 路由查詢與統計
- [x] BGP consumer / wrapper 腳本
- [x] 沙箱（Kali）執行安全工具

### Phase 12: Pentest Assist MVP `[x]`
- [x] `pentest/assist` 模組化流程
- [x] 目標枚舉 / 漏洞驗證 / 報告生成
- [x] 模組化 Steps（ToolCallBlock / StepCard）
- [x] AI 對話 + 中文支援

---

### Phase 13: MVP 驗收穩定化 `[x]`
- [x] 修復 DB drift（migration 20260520000000 修掉重複段；重置 dev DB 重新套用）
- [x] 修復後端測試可信度（移除假 summary、改用 setup 注入 TEST_API_KEY、寫實的 23 個測試）
- [x] 修復工具執行安全（WhitelistValidator 雙重檢查 + required params；tools.ts 用 validated command 執行）
- [x] 修復 protected API client（`api.tools` / `api.alerts` / `api.dashboard` + `getApiKey` / `ApiError`）
- [x] 修復告警調查流程（建立真實 Session）
- [x] 開始 ACCEPTANCE tracking（見 `specs/ACCEPTANCE.md`）
- [x] 清理前端 lint warnings
- [x] Docker / BGP 本地 profile 整理（default/dev/tools/bgp profiles）

### Phase 14: 可信 UI 與可用入口 `[x]`
- [x] `ApiKeyRequired` 共用組件（統一 401 錯誤提示 UI）
- [x] Settings 頁面 API Key 管理區（輸入、測試、保存、清除）
- [x] Tools / Alerts / Dashboard 401 統一處理
- [x] Threat / Investigation / Settings / Pentest 401 統一處理
- [x] Pentest Assist 接回 TargetInputPanel
- [x] Alerts「開始調查」導向真實 Session

### Phase 15: 深度調查工作台 `[x]`
- [x] 三欄式 Investigation Workspace（Alert+IOC / Timeline / Verdict+Actions）
- [x] 跨模組 session 載入（soc/threat/pentest）
- [x] IOC 自動提取（IP/Domain/Hash）
- [x] Alert context 關聯顯示

### Phase 16: 工具與情報證據化 `[x]`
- [x] `Evidence` Prisma model（含 FK to Session/User）
- [x] Evidence CRUD API（POST/GET/DELETE `/api/sessions/:sessionId/evidence`）
- [x] `AddToInvestigation` 共用組件接入真實 API
- [x] 工具頁面 / 情報頁面「加入證據」按鈕
- [x] Audit log 敏感參數 mask（`sanitizeAuditDetails` 覆蓋 tools/alerts/admin/evidence）
- [x] 高風險工具模板（sql_dump, hydra）預設 disabled

### Phase 17: 安全治理補強 `[x]`
- [x] Rate limiting middleware（tools/execute 10/min, alerts/import 20/min, settings/ai/test 5/min）
- [x] Audit log sanitization 全覆蓋（alerts.ts 5 處 + tools.ts + admin.ts + evidence.ts）

### Phase 18: 前端一致性 `[x]`
- [x] ApiKeyRequired 統一到全部 7 個工作流頁面
- [x] StatusBadge 組件統一替換 alerts/tools/threat 的 inline badge
- [x] 移除重複 color map（severityColors, riskColors）

---

## 下一階段

### Phase 19: 上線治理 `[x]`
- [x] 19.1 API Key 生命週期：schema migration + apiKeyAuth 撤銷/過期檢查 +恒定時間 hash + self-service rotate/revoke + admin API + 前端 UI + 測試
- [x] 19.2 Retention 管理員：mode 參數 + per-table error reporting + /api/admin/retention/{status,run} + adminRetention 前端 methods + RetentionPanel + /admin/retention 頁面 + 整合測試
- [x] 19.3 Sandbox Egress Policy：egress.conf.example + egress-policy.sh 重寫 (file>env>lock-down) + DRY_RUN + Dockerfile jq + compose config + validateEgressConfig Zod 驗證 + bats 10/10
- [x] P0 穩定化：lint fix + npm test 改 full suite + retention test raw SQL seed + .gitignore

### Phase 20: MVP 驗收與交付 `[x]`
- [x] **20-1** 端到端驗收腳本（見 `scripts/validate-e2e-journeys.sh`）
- [x] **20-2** 操作手冊（見 `docs/OPERATIONS.md`）
- [x] **20-3** Docker profile 驗收文件（見 `docs/DOCKER-PROFILES.md`）
- [x] **20-4** Demo dataset（seed.ts 已有 5 個 demo alerts + 8 個 tool templates）

### Phase 21: 前端治理頁一致化 `[x]`
- [x] /admin/keys、/admin/retention 補上共用 PageHero 與一致的 Hero Bar
- [x] RetentionPanel 補 401/403/錯誤狀態 UI（不只 loading）
- [x] API key rotate modal 禁止直接 cancel，改為明確「我已保存」後才能關閉
- [x] P0 修：retention.test.ts 改用 unique marker，讓 `npm test` 與 `npx vitest run` 都穩定
- [x] Playwright E2E：admin-keys.spec.ts + admin-retention.spec.ts 覆蓋 PageHero 與錯誤狀態

### Phase 22: 安全與 Docker 操作優化 `[x]`
- [x] **22-B** CI 中 `docker compose config` 避免輸出 secrets（見 `scripts/validate-compose-safe.sh`）
- [x] **22-C** BGP consumer 低頻 log + `/api/bgp/metrics` 端點（見 `backend/scripts/bgp-consumer.py`、`backend/src/routes/bgp.ts`）
- [x] **22-A** Sandbox egress 文件化：default compose 不啟 tools profile，dev override 說明（見 `docs/sandbox-egress.md`）

### Phase 23: CSRF 與密鑰管理強化 `[x]`
- [x] CORS origin 白名單（`ALLOWED_ORIGINS` 環境變數）
- [x] `originValidation` 中間件（POST/PUT/PATCH/DELETE Origin/Referer 驗證）
- [x] Dockerfile 移除硬編碼 `DATABASE_URL` + 非 root 用戶
- [x] `validateEnv()` 啟動時環境變數驗證
- [x] `.env.example` 完整化（`POSTGRES_PASSWORD`、`ALLOWED_ORIGINS`、第三方 API key）

### Phase 24: Analysis 同比指標與 failed_resolution `[x]`
- [x] Alert model 新增 `@@index([createdAt, status])` + `@@index([status])`
- [x] `failed_resolution` 狀態加入 PATCH Zod enum
- [x] Dashboard stats 新增 `metrics.analysis`（5 time buckets + 3 comparisons）
- [x] AnalysisCard 雙趨勢元件（MoM + YoY）
- [x] 首頁 Dashboard 改用真實 API 數據
- [x] 告警中心 `failed_resolution` UI（badge / filter / action buttons）
- [x] 22 個 analysis 單元測試全過

### Phase 25: 獨立分析頁面 `[x]`
- [x] 修正後端 SQL bucket 邏輯（獨立 period 查詢，current_year 包含 current_month）
- [x] 新增 `rowToPeriod` 單元測試（3 個）
- [x] 建立 `/analysis` 頁面（KPI 卡 + 年度同比 + 五期對照表）
- [x] Sidebar 新增「營運分析」入口
- [x] 首頁新增「查看完整分析」連結

---

## 已知風險 / 待辦細項
- [ ] sandbox 對每個 template 的 timeout 與資源上限需逐一調校
- [x] CSRF 保護（CORS origin 白名單 + originValidation 中間件）
- [x] 生產環境密鑰管理（validateEnv 啟動驗證 + Dockerfile 非 root + .env.example 完整化）
- [ ] 沒有完整 i18n（前端文案以繁中為主，英文保留技術名詞）
- [ ] AI 對話需要 OLLAMA 或 MiniMax API key（mock 模式只回固定模板）
