# Ollama Adapter 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 SecurityWeb 新增 Ollama AI Adapter，支援與 MiniMax 並行運作並可透過前端設定即時切換。

**Architecture:** 使用工廠模式建立 AIService，透過 SystemSetting 資料庫設定值判斷使用哪個 Adapter。Adapter 實作統一介面，相關模組(SOC/Threat/Pentest)透過工廠取得，不需知道實際 AI 供應商。

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Ollama OpenAI 相容 API

---

## 檔案結構

```
backend/
├── prisma/schema.prisma                           # 修改：新增 SystemSetting table
├── src/
│   ├── services/
│   │   ├── types.ts                               # 不修改：AIService 介面現有
│   │   ├── minimaxAdapter.ts                       # 不修改
│   │   ├── OllamaAdapter.ts                       # 新增
│   │   └── AIServiceFactory.ts                    # 新增
│   ├── routes/
│   │   ├── settings.ts                            # 新增
│   │   ├── soc.ts                                 # 修改：使用工廠
│   │   ├── threat.ts                              # 修改：使用工廠
│   │   └── pentest.ts                             # 修改：使用工廠
│   └── db/client.ts                               # 不修改
frontend/
└── src/
    ├── app/
    │   └── settings/                              # 新增
    │       └── page.tsx                           # 新增
    └── lib/api.ts                                 # 修改：新增 settings API
```

---

## Task 1: 資料庫 Migration

**Files:**
- Modify: `backend/prisma/schema.prisma:1-126`

- [ ] **Step 1: 在 schema.prisma 尾端新增 SystemSetting model**

在 `model BgpAsnInfo` 之後、`@@index([asn])` 之後加入：

```prisma
// 系統設定
model SystemSetting {
  id        Int     @id @default(autoincrement())
  key       String  @unique
  value     String
  desc      String?
  updatedAt DateTime @updatedAt

  @@index([key])
}
```

- [ ] **Step 2: 執行 Prisma migrate**

Run: `cd backend && npx prisma migrate dev --name add_system_setting`
Expected: Migration 建立成功，Console 輸出 `Migratched to add_system_setting`

- [ ] **Step 3: 驗證 Migration**

Run: `cd backend && npx prisma migrate status`
Expected: `Database schema is up to date`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add SystemSetting model for AI provider configuration"
```

---

## Task 2: OllamaAdapter 實作

**Files:**
- Create: `backend/src/services/OllamaAdapter.ts`

- [ ] **Step 1: 建立 OllamaAdapter.ts 基本結構**

```typescript
/**
 * Ollama AI Adapter - 使用 Ollama OpenAI 相容 API
 */

import { prisma } from '../db/client.js';
import type { AIService, ModuleType, SessionData, StepData, MessageData } from './types.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10);

// Session Cache Configuration (與 MiniMax 相同)
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_CACHE_MAX_SIZE = 100;

interface SessionCache {
  data: SessionData;
  timestamp: number;
}

// 預設步驟模板 (與 MiniMax 相同)
const defaultSteps: Record<ModuleType, Omit<StepData, 'id' | 'timestamp'>[]> = {
  soc: [
    { order: 1, title: '接收告警', status: 'pending', content: '等待接收安全告警...' },
    { order: 2, title: '威脅情報', status: 'pending', content: '正在關聯威脅情報...' },
    { order: 3, title: '攻擊還原', status: 'pending', content: '正在還原攻擊過程...' },
    { order: 4, title: '影響評估', status: 'pending', content: '正在評估業務影響...' },
    { order: 5, title: '處置建議', status: 'pending', content: '正在生成處置建議...' },
  ],
  threat: [
    { order: 1, title: '收集資料', status: 'pending', content: '正在收集目標資料...' },
    { order: 2, title: '擴展線索', status: 'pending', content: '正在擴展關聯線索...' },
    { order: 3, title: '關聯分析', status: 'pending', content: '正在進行關聯分析...' },
    { order: 4, title: '攻擊路徑', status: 'pending', content: '正在描繪攻擊路徑...' },
    { order: 5, title: '威脅報告', status: 'pending', content: '正在生成威脅報告...' },
  ],
  pentest: [
    { order: 1, title: '目標枚舉', status: 'pending', content: '正在枚舉目標範圍...' },
    { order: 2, title: '漏洞掃描', status: 'pending', content: '正在掃描潛在漏洞...' },
    { order: 3, title: '漏洞驗證', status: 'pending', content: '正在驗證發現的漏洞...' },
    { order: 4, title: '漏洞利用', status: 'pending', content: '正在評估漏洞利用可行性...' },
    { order: 5, title: '報告生成', status: 'pending', content: '正在生成滲透測試報告...' },
  ],
};

// Ollama System Prompt (簡化版，無需結構化輸出)
const SOC_SYSTEM_PROMPT = `你是 SOC 安全分析報告生成系統。收到安全告警數據後，生成結構化威脅報告。

【報告格式】
1. 首先輸出威脅判定：⚠️ 風險等級 + 攻擊類型
2. 六章報告結構：事件概要、IOC、ATT&CK、技術分析、業務影響、處置建議
3. ⚠️ 標註待確認資訊（IP、帳戶）並列為最優先
4. 禁止重複內容

【威脅判定】
⚠️ **<風險等級> <攻擊類型>**

**事件 ID**：INC-<日期>-<序號>
**發生時間**：<開始時間> ~ <結束時間>
**嚴重性**：🟢 低 / 🟡 中 / 🔴 高
**受影響資產**：<Agent ID>

---

## 一、事件概要
<2-3 句話描述：事件類型、時間範圍、次數、是否為自動化攻擊特徵>

## 二、IOC（關鍵發現）
| 類型 | 值 | 置信度 | 備註 |
|------|-----|--------|------|
| 來源 IP | **待查詢** | 嚴重 | **最優先需補充** |
| 使用帳戶 | **待查詢** | 嚴重 | 極可能為 root |
| Agent ID | <ID> | 高 | 已確認目標主機 |
| 事件特徵 | <自動化/手動> | 高/中 | <攻擊模式> |

## 三、ATT&CK 映射
| TTP | 戰術 | 技術 | 置信度 |
|-----|------|------|--------|
| T1078 | Initial Access | Valid Accounts | 高 |
| T1021 | Lateral Movement | Remote Services | 中 |

## 四、技術分析
<3-4 句話分析攻擊手法、自動化特徵、風險評估>

## 五、業務影響評估
- **機密性**：高/中/低（<原因>）
- **完整性**：高/中/低（<原因>）
- **可用性**：高/中/低（<原因>）
- **整體風險**：<評估>

## 六、處置建議（P0 優先）
1. **最優先**：<查詢來源 IP 命令>
2. 若為非信任 IP → <立即處置>
3. <其他立即動作>

【格式要求】
- ⚠️ 標註待確認資訊（IP、帳戶）並列為最優先
- 使用 Emoji 標註嚴重性（🟢🟡🔴⚠️）
- 禁止重複章節內容`;

const THREAT_SYSTEM_PROMPT = `你是一個專業的威脅情報分析師，擅長數位威脅情報調查與分析。

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

const PENTEST_SYSTEM_PROMPT = `你是一個專業的滲透測試助手，擅長協助安全測試。

當用戶提供目標和測試範圍時，請：
1. 分析目標的安全性
2. 提供測試建議和思路
3. 協助生成測試報告`;

function formatSession(session: any): SessionData {
  return {
    id: session.id,
    module: session.module,
    input: session.input,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    steps: session.steps.map((step: any) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      status: step.status,
      content: step.content || undefined,
      codeBlock: step.codeBlock || undefined,
      toolCalls: step.toolCalls || undefined,
      timestamp: step.timestamp?.toISOString() || undefined,
    })),
    messages: session.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    })),
  };
}

export class OllamaAdapter implements AIService {
  private sessionCache = new Map<string, SessionCache>();

  constructor() {
    setInterval(() => this.cleanupCache(), SESSION_CACHE_TTL_MS);
    this.warmUpCache().catch(console.error);
  }

  private async warmUpCache(): Promise<void> {
    try {
      const recentSessions = await prisma.session.findMany({
        where: { status: 'running' },
        take: 20,
        orderBy: { updatedAt: 'desc' },
        include: {
          steps: { orderBy: { order: 'asc' } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      for (const session of recentSessions) {
        const data = formatSession(session);
        this.setCachedSession(session.id, data);
      }
      if (recentSessions.length > 0) {
        console.log(`[OllamaAdapter] 热启动：预加载 ${recentSessions.length} 个活跃 session`);
      }
    } catch (error) {
      console.error('[OllamaAdapter] 热启动失败:', error);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [id, cache] of this.sessionCache) {
      if (now - cache.timestamp > SESSION_CACHE_TTL_MS) {
        this.sessionCache.delete(id);
      }
    }
    if (this.sessionCache.size > SESSION_CACHE_MAX_SIZE) {
      const entries = Array.from(this.sessionCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, this.sessionCache.size - SESSION_CACHE_MAX_SIZE);
      toRemove.forEach(([id]) => this.sessionCache.delete(id));
    }
  }

  private getCachedSession(sessionId: string): SessionData | null {
    const cached = this.sessionCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < SESSION_CACHE_TTL_MS) {
      return cached.data;
    }
    return null;
  }

  private setCachedSession(sessionId: string, data: SessionData): void {
    if (this.sessionCache.size >= SESSION_CACHE_MAX_SIZE) {
      const oldest = Array.from(this.sessionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this.sessionCache.delete(oldest[0]);
    }
    this.sessionCache.set(sessionId, { data, timestamp: Date.now() });
  }

  private invalidateSessionCache(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  private async callOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages,
        max_tokens: 8192,
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error('Ollama API returned empty response');
    }
    return content;
  }

  async startAnalysis(module: ModuleType, input: unknown): Promise<SessionData> {
    const steps = defaultSteps[module].map((step, index) => ({
      ...step,
      id: `step-${Date.now()}-${index}`,
      timestamp: new Date().toISOString(),
    }));

    const session = await prisma.session.create({
      data: {
        module,
        input: input as object,
        status: 'in_progress',
        steps: {
          create: steps.map((step) => ({
            order: step.order,
            title: step.title,
            status: step.status,
            content: step.content,
          })),
        },
      },
      include: {
        steps: true,
        messages: true,
      },
    });

    return formatSession(session);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const cached = this.getCachedSession(sessionId);
    if (cached) return cached;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) return null;
    const data = formatSession(session);
    this.setCachedSession(sessionId, data);
    return data;
  }

  async getAllSessions(): Promise<SessionData[]> {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return sessions.map(formatSession);
  }

  async sendMessage(sessionId: string, content: string): Promise<MessageData> {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: {
          steps: { orderBy: { order: 'asc' } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!session) throw new Error('Session not found');

      const userMessage = await tx.message.create({
        data: { sessionId, role: 'user', content },
      });

      const aiMessage = await tx.message.create({
        data: { sessionId, role: 'assistant', content: '' },
      });

      return { session, userMessage, aiMessage };
    });

    const { session: dbSession, userMessage, aiMessage } = result;

    const systemPrompt = dbSession.module === 'soc'
      ? SOC_SYSTEM_PROMPT
      : dbSession.module === 'threat'
      ? THREAT_SYSTEM_PROMPT
      : PENTEST_SYSTEM_PROMPT;

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...dbSession.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content },
    ];

    const aiResponse = await this.callOllama(ollamaMessages);

    await prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: aiMessage.id },
        data: { content: aiResponse },
      });
      await this.updateStepsFromAIResponseTx(tx, dbSession, aiResponse);
    });

    return {
      id: aiMessage.id,
      role: 'assistant',
      content: aiResponse,
      createdAt: aiMessage.createdAt.toISOString(),
    };
  }

  private async updateStepsFromAIResponseTx(tx: any, session: any, aiResponse: string): Promise<void> {
    const steps = session.steps.sort((a: any, b: any) => a.order - b.order);

    const stepPatterns = session.module === 'soc' ? [
      { order: 1, title: '接收告警', patterns: ['## 一、', '事件概要'] },
      { order: 2, title: '威脅情報', patterns: ['## 二、', 'IOC'] },
      { order: 3, title: '攻擊還原', patterns: ['## 三、', 'ATT&CK'] },
      { order: 4, title: '影響評估', patterns: ['## 四、', '技術分析'] },
      { order: 5, title: '處置建議', patterns: ['## 五、', '業務影響', '## 六、', '處置建議'] },
    ] : session.module === 'threat' ? [
      { order: 1, title: '收集資料', patterns: ['【指標概況】'] },
      { order: 2, title: '擴展線索', patterns: ['【威脅評估】'] },
      { order: 3, title: '關聯分析', patterns: ['【攻擊者分析】'] },
      { order: 4, title: '攻擊路徑', patterns: ['【攻擊路徑】'] },
      { order: 5, title: '威脅報告', patterns: ['【防護建議】'] },
    ] : [
      { order: 1, title: '目標枚舉', patterns: ['枚舉', '掃描'] },
      { order: 2, title: '漏洞掃描', patterns: ['漏洞', '掃描'] },
      { order: 3, title: '漏洞驗證', patterns: ['驗證', '確認'] },
      { order: 4, title: '漏洞利用', patterns: ['利用', '攻擊'] },
      { order: 5, title: '報告生成', patterns: ['報告', '總結'] },
    ];

    for (const step of steps) {
      const stepPattern = stepPatterns.find(p => p.order === step.order);
      const stepContent = this.extractStepContent(aiResponse, stepPattern) || `## ${step.title}\n\n已完成分析`;
      await tx.step.update({ where: { id: step.id }, data: { content: stepContent, status: 'success' } });
    }

    await tx.session.update({ where: { id: session.id }, data: { status: 'completed' } });
  }

  private extractStepContent(aiResponse: string, stepPattern: { order: number; title: string; patterns: string[] } | undefined): string | null {
    if (!stepPattern) return null;

    const { patterns } = stepPattern;
    const lines = aiResponse.split('\n');

    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some(p => line.includes(p))) {
        startIdx = i;
        break;
      }
    }

    if (startIdx === -1) return null;

    const nextMarkers = ['## 【', '## 一', '## 二', '## 三', '## 四', '## 五', '## 六', '---', '【'];
    for (const marker of nextMarkers) {
      const nextMatch = aiResponse.indexOf(marker, startIdx + 1);
      if (nextMatch !== -1 && nextMatch < endIdx) {
        endIdx = nextMatch;
        break;
      }
    }

    return lines.slice(startIdx, endIdx).join('\n').trim();
  }

  async getStepStatus(sessionId: string, stepId: string): Promise<StepData | null> {
    const step = await prisma.step.findFirst({
      where: { id: stepId, sessionId },
    });

    if (!step) return null;

    return {
      id: step.id,
      order: step.order,
      title: step.title,
      status: step.status as any,
      content: step.content || undefined,
      codeBlock: step.codeBlock || undefined,
      toolCalls: step.toolCalls as any || undefined,
      timestamp: step.timestamp?.toISOString() || undefined,
    };
  }
}

export const ollamaAdapter = new OllamaAdapter();
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/OllamaAdapter.ts
git commit -m "feat: add OllamaAdapter implementing AIService interface"
```

---

## Task 3: AIServiceFactory 工廠實作

**Files:**
- Create: `backend/src/services/AIServiceFactory.ts`

- [ ] **Step 1: 建立 AIServiceFactory.ts**

```typescript
/**
 * AI Service Factory - 根據設定回傳對應的 AIService 實例
 */

import { prisma } from '../db/client.js';
import { miniMaxAdapter } from './minimaxAdapter.js';
import { ollamaAdapter } from './OllamaAdapter.js';
import type { AIService } from './types.js';

// 簡單快取機制
let cachedProvider: string | null = null;
let cacheTimeout: number = 0;
const CACHE_TTL_MS = 5000; // 5 秒快取

/**
 * 取得目前的 AI Service 實例
 * 優先從快取取用，否則從資料庫讀取設定
 */
export async function getAIService(): Promise<AIService> {
  const now = Date.now();

  // 檢查快取是否有效
  if (cachedProvider && now < cacheTimeout) {
    return cachedProvider === 'ollama' ? ollamaAdapter : miniMaxAdapter;
  }

  // 從資料庫讀取設定
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'AI_PROVIDER' }
    });

    cachedProvider = setting?.value || 'minimax';
    cacheTimeout = now + CACHE_TTL_MS;

    return cachedProvider === 'ollama' ? ollamaAdapter : miniMaxAdapter;
  } catch (error) {
    // 若資料庫讀取失敗，預設使用 MiniMax
    console.error('[AIServiceFactory] 讀取設定失敗，使用預設 MiniMax:', error);
    return miniMaxAdapter;
  }
}

/**
 * 清除快取，下次呼叫時會重新讀取設定
 */
export function invalidateCache(): void {
  cachedProvider = null;
  cacheTimeout = 0;
}

/**
 * 取得目前的 AI Provider 名稱
 */
export async function getCurrentProvider(): Promise<string> {
  if (cachedProvider && Date.now() < cacheTimeout) {
    return cachedProvider;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'AI_PROVIDER' }
    });
    return setting?.value || 'minimax';
  } catch {
    return 'minimax';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/AIServiceFactory.ts
git commit -m "feat: add AIServiceFactory with caching for provider selection"
```

---

## Task 4: Settings API 實作

**Files:**
- Create: `backend/src/routes/settings.ts`

- [ ] **Step 1: 建立 settings.ts**

```typescript
/**
 * Settings API Routes - AI Provider 設定
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';
import { invalidateCache } from '../services/AIServiceFactory.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // 取得 AI 設定
  fastify.get('/api/settings/ai', async (request, reply) => {
    const provider = await prisma.systemSetting.findUnique({
      where: { key: 'AI_PROVIDER' }
    });

    const ollamaModel = await prisma.systemSetting.findUnique({
      where: { key: 'OLLAMA_MODEL' }
    });

    const ollamaBaseUrl = await prisma.systemSetting.findUnique({
      where: { key: 'OLLAMA_BASE_URL' }
    });

    return {
      provider: provider?.value || 'minimax',
      model: ollamaModel?.value || process.env.OLLAMA_MODEL || 'llama3',
      baseUrl: ollamaBaseUrl?.value || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    };
  });

  // 更新 AI 設定
  fastify.post('/api/settings/ai', async (request, reply) => {
    const { provider, model, baseUrl } = request.body as {
      provider?: 'minimax' | 'ollama';
      model?: string;
      baseUrl?: string;
    };

    if (provider) {
      await prisma.systemSetting.upsert({
        where: { key: 'AI_PROVIDER' },
        update: { value: provider },
        create: { key: 'AI_PROVIDER', value: provider, desc: 'AI 服務提供者' },
      });
    }

    if (model) {
      await prisma.systemSetting.upsert({
        where: { key: 'OLLAMA_MODEL' },
        update: { value: model },
        create: { key: 'OLLAMA_MODEL', value: model, desc: 'Ollama 模型名稱' },
      });
    }

    if (baseUrl) {
      await prisma.systemSetting.upsert({
        where: { key: 'OLLAMA_BASE_URL' },
        update: { value: baseUrl },
        create: { key: 'OLLAMA_BASE_URL', value: baseUrl, desc: 'Ollama API 端點' },
      });
    }

    // 清除工廠快取
    invalidateCache();

    return { success: true, provider: provider || 'minimax' };
  });

  // 測試 AI 連線
  fastify.post('/api/settings/ai/test', async (request, reply) => {
    const { provider } = request.body as { provider: 'minimax' | 'ollama' };

    if (provider === 'ollama') {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      const model = process.env.OLLAMA_MODEL || 'llama3';

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          return { success: true, message: `Ollama (${model}) 連線成功` };
        } else {
          const error = await response.text();
          return { success: false, message: `Ollama 連線失敗: ${response.status} - ${error}` };
        }
      } catch (error) {
        return { success: false, message: `Ollama 連線失敗: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    } else {
      // MiniMax 測試
      const apiKey = process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        return { success: false, message: 'MiniMax API Key 未設定' };
      }
      return { success: true, message: 'MiniMax 設定正確' };
    }
  });
}
```

- [ ] **Step 2: 在 index.ts 註冊 settings 路由**

Read `backend/src/index.ts` to find where routes are registered, then add:

在 routes 註冊處加入：
```typescript
import { settingsRoutes } from './routes/settings.js';
// ...
await fastify.register(settingsRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/settings.ts backend/src/index.ts
git commit -m "feat: add settings API routes for AI provider configuration"
```

---

## Task 5: 遷移現有模組使用工廠

**Files:**
- Modify: `backend/src/routes/soc.ts`
- Modify: `backend/src/routes/threat.ts`
- Modify: `backend/src/routes/pentest.ts`

- [ ] **Step 1: 遷移 soc.ts**

Read `backend/src/routes/soc.ts` and find where `miniMaxAdapter` is imported/used. Replace with `getAIService()`.

找到類似以下的程式碼：
```typescript
import { miniMaxAdapter } from '../services/minimaxAdapter.js';
// 或
import { miniMaxAdapter } from '../services/minimaxAdapter';
```

改為：
```typescript
import { getAIService } from '../services/AIServiceFactory.js';
// 或
import { getAIService } from '../services/AIServiceFactory';
```

然後在每個使用 `miniMaxAdapter.` 的方法內，將：
```typescript
const session = await miniMaxAdapter.startAnalysis(...)
```
改為：
```typescript
const ai = await getAIService();
const session = await ai.startAnalysis(...);
```

- [ ] **Step 2: 遷移 threat.ts**

同樣模式，替換 `miniMaxAdapter` 為 `getAIService()`。

- [ ] **Step 3: 遷移 pentest.ts**

同樣模式，替換 `miniMaxAdapter` 為 `getAIService()`。

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/soc.ts backend/src/routes/threat.ts backend/src/routes/pentest.ts
git commit -m "refactor: migrate SOC/Threat/Pentest to use AIServiceFactory"
```

---

## Task 6: 前端設定頁面

**Files:**
- Create: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 在 api.ts 新增 settings API**

```typescript
// 現有 api 物件中加入：
settings: {
  getAI: () => api.get('/api/settings/ai'),
  updateAI: (data: { provider?: string; model?: string; baseUrl?: string }) =>
    api.post('/api/settings/ai', data),
  testAI: (provider: string) => api.post('/api/settings/ai/test', { provider }),
},
```

- [ ] **Step 2: 建立 settings/page.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [provider, setProvider] = useState<'minimax' | 'ollama'>('minimax');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434/v1');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.settings.getAI();
      setProvider(data.provider as 'minimax' | 'ollama');
      setOllamaModel(data.model);
      setOllamaBaseUrl(data.baseUrl);
    } catch (error) {
      console.error('載入設定失敗:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.updateAI({
        provider,
        model: ollamaModel,
        baseUrl: ollamaBaseUrl,
      });
      alert('設定已儲存');
    } catch (error) {
      alert('儲存失敗: ' + error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.settings.testAI(provider);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: '測試失敗: ' + error });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">設定</h1>

      <div className="space-y-6">
        {/* AI Provider 選擇 */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">AI 服務提供者</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="provider"
                value="minimax"
                checked={provider === 'minimax'}
                onChange={() => setProvider('minimax')}
                className="w-4 h-4"
              />
              <span>MiniMax (雲端)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="radio"
                name="provider"
                value="ollama"
                checked={provider === 'ollama'}
                onChange={() => setProvider('ollama')}
                className="w-4 h-4"
              />
              <span>Ollama (本地)</span>
            </label>
          </div>
        </div>

        {/* Ollama 設定 (僅 provider === 'ollama' 時顯示) */}
        {provider === 'ollama' && (
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Ollama 設定</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">API 端點</label>
                <input
                  type="text"
                  value={ollamaBaseUrl}
                  onChange={(e) => setOllamaBaseUrl(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="http://localhost:11434/v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">模型</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="llama3"
                />
              </div>
            </div>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存設定'}
          </button>

          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? '測試中...' : '測試連線'}
          </button>
        </div>

        {/* 測試結果 */}
        {testResult && (
          <div className={`p-4 rounded ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
              {testResult.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/settings/page.tsx frontend/src/lib/api.ts
git commit -m "feat: add settings page for AI provider configuration"
```

---

## 驗證清單

- [ ] 所有 Migration 已執行
- [ ] OllamaAdapter 實作完整並編譯成功
- [ ] AIServiceFactory 工廠正確運作
- [ ] Settings API 端點可正常存取
- [ ] SOC/Threat/Pentest 模組使用工廠取得 AIService
- [ ] 前端設定頁面可正常運作
- [ ] Provider 切換後新請求使用正確的 Adapter

---

**Plan complete.**