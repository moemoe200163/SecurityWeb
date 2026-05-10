# Ollama Adapter 設計規格

## 概述

為 SecurityWeb 平台新增 Ollama AI Adapter，支援與現有 MiniMax Adapter 並行運作。使用者可透過前端設定介面即時切換 AI 服務提供者，無需重啟服務。

## 架構

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Service Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AIServiceFactory (工廠模式)              │   │
│  │         getAIService(): AIService                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ MiniMax     │  │  Ollama     │  │ (未來擴展)   │         │
│  │ Adapter     │  │  Adapter    │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │               │                                    │
│         └───────────────┼────────────────────────────────────┤
│                         ▼                                    │
│            AIService Interface (types.ts)                   │
└─────────────────────────────────────────────────────────────┘
```

## 資料庫變更

### 新增 SystemSetting Table

```prisma
model SystemSetting {
  id        Int     @id @default(autoincrement())
  key       String  @unique
  value     String
  desc      String?
  updatedAt DateTime @updatedAt
}
```

### 預設設定

| Key | Value | Description |
|-----|-------|-------------|
| `AI_PROVIDER` | `minimax` | 目前使用的 AI 服務 (`minimax` 或 `ollama`) |
| `OLLAMA_MODEL` | `llama3` | Ollama 預設模型 |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama API 端點 |

## 檔案結構

```
backend/src/services/
├── types.ts              # AIService 介面 (現有，不修改)
├── minimaxAdapter.ts     # MiniMax 實作 (現有，不修改)
├── OllamaAdapter.ts      # 新增：Ollama 實作
└── AIServiceFactory.ts   # 新增：工廠函式
```

## OllamaAdapter 實作

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI 相容端點 |
| `OLLAMA_MODEL` | `llama3` | 預設模型 |
| `OLLAMA_TIMEOUT` | `120000` | 請求超時 (ms) |

### API 呼叫格式

使用 Ollama 的 OpenAI 相容端點 `/v1/chat/completions`：

```typescript
POST /v1/chat/completions
{
  "model": "llama3",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "max_tokens": 8192
}
```

### 主要方法實作

| 方法 | 說明 |
|------|------|
| `startAnalysis()` | 建立 Session 並初始化 5 步驟，**不使用** MiniMax 的 5 步驟系統提示詞 |
| `sendMessage()` | 傳送訊息並解析 AI 回應，更新步驟內容 |
| `getSession()` | 從資料庫或快取取得 Session |
| `getAllSessions()` | 取得所有 Sessions |
| `getStepStatus()` | 取得特定步驟狀態 |

### Ollama System Prompt 調整

由於 Ollama 沒有 MiniMax 的結構化輸出，需調整 prompt 格式以適配：

```typescript
// Ollama 使用的 system prompt（簡化版）
const THREAT_SYSTEM_PROMPT_OLLAMA = `你是一個專業的威脅情報分析師。

當用戶輸入 IP、域名或雜湊值時，請輸出以下格式的分析報告：

【指標概況】
- 指標類型:
- 指標值:
- 分析時間:

【威脅評估】
- 風險等級:
- 置信度:
- 威脅類型:

【攻擊者分析】
- 攻擊背景:
- 歷史活動:

【攻擊路徑】
- 可能的攻擊方式:
- Kill Chain 分析:

【防護建議】
- 即時處置:
- 長期防護:`;
```

## AIServiceFactory 工廠函式

```typescript
// 簡單快取機制，避免每次請求都查 DB
let cachedProvider: string | null = null;
let cacheTimeout: number = 0;
const CACHE_TTL_MS = 5000; // 5 秒快取

export async function getAIService(): Promise<AIService> {
  const now = Date.now();

  // 重新檢查快取
  if (cachedProvider && now < cacheTimeout) {
    return cachedProvider === 'ollama' ? ollamaAdapter : miniMaxAdapter;
  }

  // 從資料庫讀取設定
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'AI_PROVIDER' }
  });

  cachedProvider = setting?.value || 'minimax';
  cacheTimeout = now + CACHE_TTL_MS;

  return cachedProvider === 'ollama' ? ollamaAdapter : miniMaxAdapter;
}

export function invalidateCache(): void {
  cachedProvider = null;
  cacheTimeout = 0;
}
```

## API 端點新增

### 1. 取得 AI 設定
```
GET /api/settings/ai
Response: { provider: "minimax" | "ollama", model?: string }
```

### 2. 更新 AI 設定
```
POST /api/settings/ai
Body: { provider: "minimax" | "ollama", model?: string }
Response: { success: true }
```

### 3. 測試 AI 連線
```
POST /api/settings/ai/test
Body: { provider: "minimax" | "ollama" }
Response: { success: boolean, message: string }
```

## 前端整合

### 設定頁面需求

1. **Provider 選擇** - Radio button 切換 MiniMax/Ollama
2. **Ollama 設定** - 當選擇 Ollama 時顯示：
   - Base URL 輸入框
   - Model 選擇/輸入框
3. **連線測試按鈕** - 測試目前設定是否正常

### 技術實作

- 前端呼叫 `POST /api/settings/ai` 更新設定
- 所有需要 AI 的模組 (SOC, Threat, Pentest) 透過 `getAIService()` 取得當前 adapter
- 完全不需要知道當前是 MiniMax 還是 Ollama

## 不相容性處理

### MiniMax 專屬功能

| 功能 | MiniMax | Ollama | 處理方式 |
|------|---------|--------|----------|
| 結構化輸出 | 原生支援 | 不支援 | Ollama 使用 Markdown 格式 |
| 速率限制 | 60 req/min | 無限制 | Ollama 移除 rate limit |
| API Key 驗證 | 需要 | 不需要 | Ollama 移除 auth header |

### 步驟解析調整

Ollama 的回應解析需要更寬鬆的模式匹配，因為輸出格式可能略有差異。

## 測試策略

1. **單元測試** - OllamaAdapter 個別方法
2. **整合測試** - 工廠模式切換
3. **E2E 測試** - 前端設定頁面 + 後端 API

## 實作順序

1. 資料庫：新增 SystemSetting model + migrate
2. OllamaAdapter：實作完整介面
3. AIServiceFactory：工廠函式 + 快取
4. Settings API：設定 CRUD + 測試端點
5. 前端設定頁面：Provider 切換 UI
6. 現有模組遷移：改用 `getAIService()`

## 預計產出檔案

- `backend/prisma/schema.prisma` (修改)
- `backend/src/services/OllamaAdapter.ts` (新增)
- `backend/src/services/AIServiceFactory.ts` (新增)
- `backend/src/routes/settings.ts` (新增)
- `frontend/src/app/settings/page.tsx` (新增或修改)