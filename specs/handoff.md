# handoff.md - 安全智能體 AI 對話網站

## 當前狀態
Phase 1-7 全部完成。專案主體開發完成，進入可部署狀態。

## 已完成項目

### 前端
- [x] Next.js 14 + TypeScript + Tailwind + shadcn/ui 專案
- [x] 頁面佈局（Sidebar + MainContent）
- [x] 核心組件：StepCard, StepProgress, StepList, ToolCallBlock
- [x] AIChatPanel, AlertUpload, AnalysisReport
- [x] Zustand 狀態管理（stepStore）
- [x] SOC 模組頁面（/soc/analyze）- 帶完整模擬分析流程
- [x] 威脅情報模組頁面（/threat/investigate）
- [x] 滲透測試模組頁面（/pentest/assist）
- [x] Docker 支援（standalone output）

### 後端
- [x] Fastify + TypeScript 專案
- [x] Prisma ORM + PostgreSQL Schema
- [x] AI Bridge 抽象層（MockAIService）
- [x] SOC API 路由（/api/soc/*）
- [x] 威脅情報 API 路由（/api/threat/*）
- [x] 滲透測試 API 路由（/api/pentest/*）
- [x] Session + Message 管理
- [x] 模擬模式自動執行

### 部署
- [x] 前端 Dockerfile
- [x] 後端 Dockerfile
- [x] docker-compose.yml（前端 + 後端 + PostgreSQL）

## 目錄結構

```
SecurityWeb/
├── frontend/                    # Next.js 前端
│   ├── src/
│   │   ├── app/                # 頁面
│   │   ├── components/         # UI 組件
│   │   ├── stores/             # Zustand
│   │   └── lib/                # 工具函數
│   ├── Dockerfile
│   └── next.config.ts
├── backend/                    # Fastify 後端
│   ├── src/
│   │   ├── routes/            # API 路由
│   │   ├── services/          # AI 服務
│   │   └── db/                # 資料庫客戶端
│   ├── prisma/schema.prisma   # 資料庫 Schema
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml          # 統一部署
├── specs/                      # 狀態檔案
└── docs/                       # 設計文件
```

## 啟動方式

### 本地開發
```bash
# 前端
cd frontend && npm run dev

# 後端（需要 PostgreSQL）
cd backend && npm run dev
```

### Docker 部署
```bash
docker-compose up --build
```

- 前端：http://localhost:3000
- 後端：http://localhost:4000
- PostgreSQL：localhost:5432

### 資料庫初始化
```bash
cd backend
cp .env.example .env
# 編輯 .env 中的 DATABASE_URL
npm run db:push
```

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/soc/analyze | SOC 告警分析 |
| GET | /api/soc/sessions | 取得所有 SOC 工作階段 |
| GET | /api/soc/sessions/:id | 取得特定工作階段 |
| POST | /api/soc/sessions/:id/messages | 傳送訊息 |
| POST | /api/threat/investigate | 威脅情報調查 |
| GET | /api/threat/sessions | 取得所有威脅工作階段 |
| POST | /api/pentest/assist | 滲透測試輔助 |
| GET | /api/pentest/sessions | 取得所有滲透工作階段 |
| GET | /health | 健康檢查 |

## 下一步建議

1. **實機對接**：將 MockAIService 替換為真實的 AI API
2. **用戶認證**：加入 JWT 或其他認證機制
3. **錯誤處理**：強化錯誤處理和日誌記錄
4. **測試**：加入單元測試和整合測試

## 技術決策記錄
- 前後端分離架構（方案B）
- 簡約淺色企業風（白色/淺灰背景 + 藍色強調）
- 用戶觸發逐步執行
- PostgreSQL 作為資料庫
- AI Bridge 預留擴展介面
- Docker 容器化部署
