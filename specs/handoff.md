# handoff.md - 安全智能體 AI 對話網站

## 當前狀態
Phase 1-5 前端核心框架已完成。三大模組頁面已建立，帶模擬模式。

## 已完成項目
- [x] 需求訪談完成
- [x] 架構方案確認（方案B：前後端分離）
- [x] 技術棧確認（Next.js 14 + TypeScript + Tailwind + shadcn/ui + Fastify + PostgreSQL + Prisma）
- [x] 功能清單確認（三大模組 + 對話面板）
- [x] 規格文件撰寫完成
- [x] Next.js 14 前端專案初始化
- [x] Tailwind + shadcn/ui 設定完成
- [x] 頁面佈局（Sidebar + MainContent）
- [x] 核心組件：StepCard、StepProgress、StepList、ToolCallBlock、AIChatPanel、AlertUpload、AnalysisReport
- [x] Zustand 狀態管理
- [x] SOC 模組頁面（/soc/analyze）- 帶模擬分析流程
- [x] 威脅情報模組頁面（/threat/investigate）
- [x] 滲透測試模組頁面（/pentest/assist）

## 架構摘要

### 前端目錄結構
```
frontend/src/
├── app/
│   ├── layout.tsx              # 根佈局（含 TooltipProvider + Providers）
│   ├── page.tsx                # 入口，重新導向到 /soc/analyze
│   ├── soc/analyze/page.tsx   # SOC 告警分析頁面（核心）
│   ├── threat/investigate/    # 威脅情報頁面
│   └── pentest/assist/         # 滲透測試頁面
├── components/
│   ├── layout/                 # Sidebar, Header, MainContent, AppShell, Providers
│   ├── steps/                  # StepCard, StepProgress, StepList
│   ├── toolcall/               # ToolCallBlock
│   ├── chat/                   # AIChatPanel
│   ├── upload/                 # AlertUpload
│   ├── report/                 # AnalysisReport
│   └── ui/                     # shadcn/ui 組件
├── stores/stepStore.ts         # Zustand 狀態管理
└── lib/types.ts               # TypeScript 類型定義
```

### 後端（待實作）
- Fastify 或 Express
- Prisma ORM + PostgreSQL
- AI Bridge 抽象層（預留）

### 部署（待實作）
- Docker + docker-compose
- 前端：3000 port
- 後端：4000 port
- PostgreSQL：5432 port

## 已驗證功能
- ✅ npm run build 成功
- ✅ 開發伺服器可以啟動（localhost:3000）
- ✅ 頁面正確重新導向到 /soc/analyze
- ✅ 三大模組頁面都可訪問

## 下一步
1. Phase 6: 後端 API 層
   - 初始化後端專案
   - 設定 Prisma + PostgreSQL
   - 實作 AI Bridge 抽象層

2. Phase 7: Docker 部署
   - 撰寫 Dockerfile
   - 撰寫 docker-compose.yml

## 技術決策記錄
- 前後端分離架構（方案B）
- 簡約淺色企業風（白色/淺灰背景 + 藍色強調）
- 用戶觸發逐步執行（不是自動播放）
- PostgreSQL 作為資料庫
- AI Bridge 預留擴展介面
- SOC 分析頁面使用模擬數據演示完整流程

## 已知問題
- 無
