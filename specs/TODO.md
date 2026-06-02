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

### Phase 19: 上線治理 `[ ]`
- [ ] API key 改 hash 儲存（DB 不保存明文 key）
- [ ] 補資料保留策略（audit log / tool execution output / BGP update retention）
- [ ] Sandbox egress policy 預設限制到授權 scope
- [ ] 完整 E2E smoke test（Playwright）

### Phase 20: 驗收與交付 `[ ]`
- [ ] 端到端驗收每個使用者旅程（SOC / Threat / Pentest）
- [ ] 文件化操作手冊（如何 seed、如何取得 admin key）
- [ ] Docker profile 驗收文件
- [ ] Demo dataset → 完整 AISOC 閉環展示

---

## 已知風險 / 待辦細項
- [ ] sandbox 對每個 template 的 timeout 與資源上限需逐一調校
- [ ] Sandbox 網路策略：egress 目前是開放的，需收緊
- [ ] API key 沒有過期 / 撤銷機制（目前只支援 admin 強制重發）
- [ ] 沒有 audit_log 保留策略（會無限增長）
- [ ] 沒有完整 i18n（前端文案以繁中為主，英文保留技術名詞）
