# TODO.md - 安全智能體 AI 對話網站

## 項目概述
建立一個前後端分離的 AI 安全助手系統，用於：
- SOC 告警分析（快速研判、處置建議）
- 威脅情報調查（自動化線索挖掘）
- 滲透測試輔助（步驟引導、報告生成）

## 當前任務

### Phase 1: 項目初始化
- [x] 初始化 Next.js 14 前端專案
- [x] 設定 Tailwind + shadcn/ui
- [x] 建立 specs 目錄結構
- [x] 撰寫規格文件

### Phase 2: 前端核心框架
- [x] 建立頁面佈局（Sidebar + MainContent）
- [x] 實作頂部進度條組件（StepProgress）
- [x] 實作步進式卡片組件（StepCard）
- [x] 實作工具調用展示區（ToolCallBlock）
- [x] 建立狀態管理（Zustand stepStore）

### Phase 3: SOC 模組頁面
- [x] 建立 /soc/analyze 頁面
- [x] 實作告警上傳區（AlertUpload）
- [x] 實作 AI 即時對話面板（AIChatPanel）
- [x] 實作分析報告生成（AnalysisReport）

### Phase 4: 威脅情報模組
- [x] 建立 /threat/investigate 頁面
- [x] 實作 IP/Domain/Hash 輸入區
- [x] 實作線索挖掘流程

### Phase 5: 滲透測試模組
- [x] 建立 /pentest/assist 頁面
- [x] 實作目標枚舉步驟
- [x] 實作漏洞驗證流程

### Phase 6: 後端 API 層
- [x] 初始化後端專案
- [x] 設定 Prisma + PostgreSQL
- [x] 實作 AI Bridge 抽象層
- [x] 實作 API 路由

### Phase 7: Docker 部署
- [x] 撰寫前端 Dockerfile
- [x] 撰寫後端 Dockerfile
- [x] 撰寫 docker-compose.yml

---

## 完成條件
所有 `[ ]` 項目都變成 `[x]` 且 ACCEPTANCE.md 所有條目為 PASS 時，專案完成。
