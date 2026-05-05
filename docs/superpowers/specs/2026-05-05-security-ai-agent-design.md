# 安全智能體 AI 對話網站 - 設計規格書

**版本**: 1.0
**日期**: 2026-05-05
**狀態**: 已確認

---

## 1. 專案概述

### 1.1 專案目標
建立一個**前後端分離**的 AI 安全助手系統，用於內部安全運維人員：

- **SOC 告警分析**：快速研判、威脅評級、處置建議
- **威脅情報調查**：自動化線索挖掘、IOC 收集、攻擊路徑分析
- **滲透測試輔助**：步驟引導、漏洞驗證、報告生成

### 1.2 設計原則
- **模組化**：三大功能各自獨立，互不耦合
- **透明度**：讓用戶看到 AI 每一步在幹什麼（Step-by-Step 視覺化）
- **可控性**：用戶觸發逐步執行，可隨時介入提問
- **可擴展**：預留 AI Bridge 介面，未來可對接真實 AI 後端

---

## 2. 系統架構

### 2.1 整體架構（方案 B：前後端分離）

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (Next.js)                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │   SOC    │  │  Threat  │  │ Pentest   │              │
│  │  Module  │  │  Module  │  │  Module   │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┼─────────────┘                     │
│              ┌──────┴──────┐                              │
│              │  AI Bridge  │  (統一介面)                  │
└──────────────┴──────┬──────┴──────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────┴───────────────────────────────────┐
│                   後端 (Fastify + Prisma)                  │
│                                                          │
│   ┌─────────────┐    ┌─────────────┐                    │
│   │  API Server │◄──►│ PostgreSQL  │                    │
│   └─────────────┘    └─────────────┘                    │
└───────────────────────────────────────────────────────────┘
```

### 2.2 前端目錄結構

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根佈局
│   │   ├── page.tsx               # 首頁（功能入口）
│   │   ├── soc/
│   │   │   ├── page.tsx           # SOC 首頁
│   │   │   └── analyze/page.tsx   # AI 分析頁面（核心）
│   │   ├── threat/
│   │   │   ├── page.tsx           # 威脅情報首頁
│   │   │   └── investigate/page.tsx
│   │   └── pentest/
│   │       ├── page.tsx           # 滲透測試首頁
│   │       └── assist/page.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn/ui 基礎元件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # 左側功能選單
│   │   │   ├── Header.tsx        # 頂部標題
│   │   │   └── MainContent.tsx    # 主內容區
│   │   ├── steps/
│   │   │   ├── StepCard.tsx      # 單一步驟卡片
│   │   │   ├── StepList.tsx      # 步驟列表容器
│   │   │   └── StepProgress.tsx   # 頂部進度條
│   │   ├── toolcall/
│   │   │   └── ToolCallBlock.tsx # 工具調用展示
│   │   ├── chat/
│   │   │   └── AIChatPanel.tsx   # AI 即時對話面板
│   │   ├── upload/
│   │   │   └── AlertUpload.tsx   # 告警上傳區
│   │   └── report/
│   │       └── AnalysisReport.tsx # 分析報告生成
│   ├── lib/
│   │   ├── api.ts                # API 請求封裝
│   │   ├── types.ts              # 共用 TypeScript 類型
│   │   └── utils.ts              # 通用工具函數
│   └── stores/
│       └── stepStore.ts          # Zustand 狀態管理
├── docker-compose.yml
└── Dockerfile
```

### 2.3 後端目錄結構

```
backend/
├── src/
│   ├── routes/
│   │   ├── soc.ts
│   │   ├── threat.ts
│   │   └── pentest.ts
│   ├── services/
│   │   ├── aiService.ts          # AI 統一服務介面
│   │   ├── mockAIService.ts      # 模擬實現
│   │   └── types.ts
│   ├── db/
│   │   ├── client.ts
│   │   └── schema.prisma
│   └── index.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
└── Dockerfile
```

---

## 3. 前端組件詳細設計

### 3.1 StepCard 組件

**用途**：顯示單一分析步驟的狀態和內容

**Props**：
```typescript
interface StepCardProps {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error';
  content?: string;      // Markdown 格式
  codeBlock?: string;   // 程式碼區塊
  toolCalls?: ToolCall[];
  timestamp?: string;
}
```

**視覺設計**：
- 左側彩色垂直線：
  - `pending`：灰色（#9CA3AF）
  - `running`：藍色（#3B82F6）+ pulse 動畫
  - `success`：綠色（#22C55E）
  - `error`：紅色（#EF4444）
- 狀態標籤（右上角）
- 可展開/收合內容區

### 3.2 StepProgress 組件

**用途**：頂部水平進度條，顯示整體分析進度

**Props**：
```typescript
interface StepProgressProps {
  steps: { id: string; label: string; status: StepStatus }[];
  currentStep: number;
}
```

**預設步驟（可根據模組調整）**：
1. 接收告警
2. 威脅情報
3. 攻擊還原
4. 影響評估
5. 處置建議

### 3.3 ToolCallBlock 組件

**用途**：展示 AI 工具調用過程（如 MCP、YAML、API 呼叫）

**Props**：
```typescript
interface ToolCallBlockProps {
  toolName: string;
  status: 'calling' | 'success' | 'error';
  params?: Record<string, any>;
  result?: any;
}
```

**視覺**：模仿截圖中的 YAML 展示樣式

### 3.4 AIChatPanel 組件

**用途**：讓用戶在分析過程中隨時提問介入

**功能**：
- 文字輸入框
- 訊息列表
- AI 回應流式輸出
- 對話歷史滾動

### 3.5 AlertUpload 組件

**用途**：上傳或貼入原始告警

**功能**：
- 拖拽上傳（JSON/CSV/TXT）
- 文字貼上區
- 格式驗證

### 3.6 AnalysisReport 組件

**用途**：渲染最終結構化報告

**報告章節**：
1. 事件概要
2. 關鍵指標（IOCs）
3. 攻擊過程還原
4. MITRE ATT&CK 映射
5. 技術分析
6. 威脅情報評估
7. 業務影響評估
8. 根本原因分析
9. 處置建議
10. 總結與風險等級

**功能**：
- Markdown 渲染
- 表格支援
- 一鍵複製
- 匯出功能預留

---

## 4. 頁面設計

### 4.1 左側 Sidebar（所有模組共用）

**功能選單**：
- 首頁儀表板
- **SOC 告警分析**
  - 深度調查
  - 快速分析處置
  - 歷史分析記錄
- **威脅情報調查**
  - IP/域名查詢
  - 批量查詢
- **滲透測試輔助**
  - 新建任務
  - 任務歷史
- 系統設定

### 4.2 SOC 分析頁面（/soc/analyze）

**佈局（垂直堆疊）**：

```
┌──────────────────────────────────────────────────────┐
│ Header: 安全智能體 · SOC 告警分析                      │
├──────────────────────────────────────────────────────┤
│ StepProgress: [1]→[2]→[3]→[4]→[5]                   │
├──────────────────────────────────────────────────────┤
│ AlertUpload: [拖拽上傳] [或貼上內容] [開始分析]        │
├──────────────────────────────────────────────────────┤
│ StepCard: 接收告警           [✅ 已完成]              │
│   └─ 內容：解析到告警 SOC-2024-001...                │
├──────────────────────────────────────────────────────┤
│ StepCard: 威脅情報           [🔄 執行中]             │
│   └─ ToolCall: 調用 threat_intelligence.yaml        │
│   └─ 內容：關聯分析中...                             │
├──────────────────────────────────────────────────────┤
│ StepCard: 攻擊還原           [⏳ 待執行]              │
├──────────────────────────────────────────────────────┤
│ StepCard: 影響評估           [⏳ 待執行]              │
├──────────────────────────────────────────────────────┤
│ StepCard: 處置建議           [⏳ 待執行]              │
├──────────────────────────────────────────────────────┤
│ AIChatPanel: [可以輸入問題]                           │
├──────────────────────────────────────────────────────┤
│ AnalysisReport: [最終報告渲染區]                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. API 設計

### 5.1 端點列表

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/soc/analyze` | SOC 告警分析 |
| POST | `/api/threat/investigate` | 威脅情報調查 |
| POST | `/api/pentest/assist` | 滲透測試輔助 |
| GET | `/api/sessions/:id` | 取得工作階段 |
| POST | `/api/sessions` | 建立新工作階段 |
| GET | `/api/sessions` | 取得所有工作階段 |

### 5.2 請求/回應範例

**POST /api/soc/analyze**
```json
// Request
{
  "alertId": "SOC-2024-001",
  "type": "simulation"  // or "live"
}

// Response
{
  "sessionId": "uuid",
  "status": "in_progress",
  "currentStep": 1
}
```

### 5.3 AI Bridge 介面

```typescript
interface AIService {
  // 初始化分析，返回 session ID
  startAnalysis(module: string, input: any): Promise<Session>;

  // 取得當前步驟狀態
  getStepStatus(sessionId: string, stepId: string): Promise<Step>;

  // 發送用戶訊息
  sendMessage(sessionId: string, message: string): Promise<void>;

  // 生成最終報告
  generateReport(sessionId: string): Promise<Report>;
}
```

---

## 6. 資料模型

### 6.1 Prisma Schema

```prisma
model Session {
  id          String   @id @default(uuid())
  module      String   // "soc" | "threat" | "pentest"
  input       Json     // 原始輸入資料
  status      String   // "in_progress" | "completed"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  steps       Step[]
  messages    Message[]
}

model Step {
  id          String   @id @default(uuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id])
  order       Int
  title       String
  status      String   // "pending" | "running" | "success" | "error"
  content     String?  // Markdown content
  codeBlock   String?  // Code snippet
  toolCalls   Json?    // Tool call records
  timestamp   DateTime?
}

model Message {
  id          String   @id @default(uuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id])
  role        String   // "user" | "assistant"
  content     String
  createdAt   DateTime @default(now())
}
```

---

## 7. Docker 部署

### 7.1 docker-compose.yml

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:4000

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/securityweb
      - PORT=4000
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=securityweb
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  pgdata:
```

---

## 8. 技術棧總結

| 層面 | 技術 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| 語言 | TypeScript |
| 樣式 | Tailwind CSS |
| UI 组件 | shadcn/ui |
| 狀態管理 | Zustand |
| 後端框架 | Fastify |
| 資料庫 | PostgreSQL 15 |
| ORM | Prisma |
| 容器化 | Docker + docker-compose |
| AI 介面 | AI Bridge（抽象層，預留擴展） |

---

## 9. 開發優先順序

### Phase 1: 專案初始化
1. 建立前端 Next.js 專案
2. 設定 Tailwind + shadcn/ui
3. 建立後端 Fastify 專案
4. 設定 Prisma + PostgreSQL

### Phase 2: 前端核心框架
1. 頁面佈局（Sidebar + MainContent）
2. StepCard、StepProgress 組件
3. 狀態管理（stepStore）

### Phase 3: SOC 模組（第一個完成的模組）
1. /soc/analyze 頁面
2. AlertUpload、AIChatPanel
3. 模擬模式（用戶觸發逐步執行）

### Phase 4: 其他模組 + 後端
1. 威脅情報模組
2. 滲透測試模組
3. 後端 API + AI Bridge

### Phase 5: Docker 部署
1. 撰寫 Dockerfile
2. 撰寫 docker-compose.yml
3. 測試完整部署流程

---

**規格文件結束**
