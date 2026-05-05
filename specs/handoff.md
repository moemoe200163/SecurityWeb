# handoff.md - 安全智能體 AI 對話網站

## 當前狀態
設計階段已完成，準備進入實作。

## 已完成項目
- [x] 需求訪談完成
- [x] 架構方案確認（方案B：前後端分離）
- [x] 技術棧確認（Next.js 14 + TypeScript + Tailwind + shadcn/ui + Fastify + PostgreSQL + Prisma）
- [x] 功能清單確認（三大模組 + 對話面板）
- [x] 規格文件撰寫完成

## 架構摘要

### 前端
- Next.js 14 App Router
- 三大模組頁面：/soc/analyze、/threat/investigate、/pentest/assist
- 核心組件：StepCard、StepProgress、ToolCallBlock、AIChatPanel、AlertUpload、AnalysisReport
- 狀態管理：Zustand

### 後端
- Fastify（推薦）或 Express
- Prisma ORM + PostgreSQL
- AI Bridge 抽象層（預留）

### 部署
- Docker + docker-compose
- 前端：3000 port
- 後端：4000 port
- PostgreSQL：5432 port

## 下一步
從 TODO.md 的第一個項目開始實作：初始化 Next.js 14 前端專案

## 技術決策記錄
- 前後端分離架構（方案B）
- 簡約淺色企業風
- 用戶觸發逐步執行（不是自動播放）
- PostgreSQL 作為資料庫
- AI Bridge 預留擴展介面
