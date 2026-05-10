/**
 * Ollama AI Adapter - 完整實現
 *
 * 使用 Ollama (OpenAI 相容 API) 進行 AI 對話
 */

import { prisma } from '../db/client.js';
import type { AIService, ModuleType, SessionData, StepData, MessageData } from './types.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10);

// Session Cache Configuration
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_CACHE_MAX_SIZE = 100;

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SessionCache {
  data: SessionData;
  timestamp: number;
}

// 預設步驟模板
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

// SOC 分析的 system prompt - 簡潔報告格式
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

// 威脅情報的 system prompt
const THREAT_SYSTEM_PROMPT = `你是一個專業的威脅情報分析師，擅長數位威脅情報調查與分析。

當用戶輸入 IP、域名或雜湊值時，請：
1. 首先使用工具查詢本地 IP 信譽資料庫（可使用 fetch 呼叫 http://localhost:4000/api/ip/check?ip=目標IP）
2. 分析該威脅指標的特徵
3. 關聯相關威脅情報
4. 提供攻擊者行為模式
5. 繪製攻擊路徑
6. 生成詳細的威脅報告

重要：當分析 IP 位址時，請先呼叫本地資料庫取得客觀信譽資料，並將其納入分析。

輸出格式：
1. 指標概況
2. 威脅評估（需結合本地資料庫資料）
3. 攻擊者分析
4. 攻擊路徑圖
5. 防護建議`;

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
  // Session In-Memory Cache
  private sessionCache = new Map<string, SessionCache>();

  // Clear expired cache entries periodically
  constructor() {
    setInterval(() => this.cleanupCache(), SESSION_CACHE_TTL_MS);
    // 热启动：预加载最近活跃的 session
    this.warmUpCache().catch(console.error);
  }

  /**
   * 热启动：预加载最近活跃的 session 到内存缓存
   */
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
    // Limit cache size
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
    // Prune if at capacity
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

  private async callOllama(messages: OllamaMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: 8192,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      // Handle OpenAI format: choices[0].message.content
      const content = data.choices?.[0]?.message?.content;
      if (content === undefined || content === null) {
        throw new Error('Ollama API returned empty response');
      }
      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama API timeout after ${OLLAMA_TIMEOUT}ms`);
      }
      throw error;
    }
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

    const data = formatSession(session);
    this.setCachedSession(session.id, data);
    return data;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    // Check cache first
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
    // 在事务中执行：获取session + 创建消息
    const result = await prisma.$transaction(async (tx) => {
      // 获取 session
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: {
          steps: { orderBy: { order: 'asc' } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!session) throw new Error('Session not found');

      // 儲存用戶訊息
      const userMessage = await tx.message.create({
        data: { sessionId, role: 'user', content },
      });

      // 儲存 AI 回應
      const aiMessage = await tx.message.create({
        data: { sessionId, role: 'assistant', content: '' },
      });

      return { session, userMessage, aiMessage };
    });

    // 从结果中提取数据
    const { session: dbSession, userMessage, aiMessage } = result;

    // 建構 Ollama 訊息列表
    const systemPrompt = dbSession.module === 'soc'
      ? SOC_SYSTEM_PROMPT
      : dbSession.module === 'threat'
      ? THREAT_SYSTEM_PROMPT
      : '你是一個專業的滲透測試助手，擅長協助安全測試。';

    const ollamaMessages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...dbSession.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content },
    ];

    // 呼叫 Ollama API
    const aiResponse = await this.callOllama(ollamaMessages);

    // 批量更新 AI 响应+步骤
    await prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: aiMessage.id },
        data: { content: aiResponse },
      });
      await this.updateStepsFromAIResponseTx(tx, dbSession, aiResponse);
    });

    // Invalidate cache after message sent
    this.invalidateSessionCache(sessionId);

    return {
      id: aiMessage.id,
      role: 'assistant',
      content: aiResponse,
      createdAt: aiMessage.createdAt.toISOString(),
    };
  }

  /**
   * 事务版本：解析 AI 响应并更新步骤（用于事务中）
   */
  private async updateStepsFromAIResponseTx(tx: any, session: any, aiResponse: string): Promise<void> {
    const steps = session.steps.sort((a: any, b: any) => a.order - b.order);

    const stepPatterns = session.module === 'soc' ? [
      { order: 1, title: '接收告警', patterns: ['第1步', '安全運營專家', '威脅情報溯源'] },
      { order: 2, title: '威脅情報', patterns: ['第2步', '威脅情報專家', '搜索結果'] },
      { order: 3, title: '攻擊還原', patterns: ['第3步', '威脅分析專家', '日誌特徵'] },
      { order: 4, title: '影響評估', patterns: ['第4步', '編碼專家', 'Python'] },
      { order: 5, title: '處置建議', patterns: ['第5步', '安全事件分析報告', '攻擊鏈'] },
    ] : [
      { order: 1, title: '收集資料', patterns: ['第1步', '收集資料', '威脅判定'] },
      { order: 2, title: '擴展線索', patterns: ['第2步', '擴展線索', '關鍵發現'] },
      { order: 3, title: '關聯分析', patterns: ['第3步', '關聯分析', '關聯服務'] },
      { order: 4, title: '攻擊路徑', patterns: ['第4步', '攻擊路徑', '攻擊方式'] },
      { order: 5, title: '威脅報告', patterns: ['第5步', '威脅報告', '建議'] },
    ];

    // 批量更新所有步骤
    for (const step of steps) {
      const stepPattern = stepPatterns.find(p => p.order === step.order);
      const stepContent = this.extractStepContent(aiResponse, stepPattern) || `## ${step.title}\n\n已完成分析`;
      await tx.step.update({ where: { id: step.id }, data: { content: stepContent, status: 'success' } });
    }

    // 完成 session
    await tx.session.update({ where: { id: session.id }, data: { status: 'completed' } });
  }

  /**
   * 從 AI 回應中提取特定步驟的內容
   * 適配 Ollama 的非結構化輸出
   */
  private extractStepContent(aiResponse: string, stepPattern: { order: number; title: string; patterns: string[] } | undefined): string | null {
    if (!stepPattern) return null;

    const { patterns } = stepPattern;
    const lines = aiResponse.split('\n');

    // 找出第 N 步的位置 - 支援多種格式
    let startIdx = -1;
    let endIdx = lines.length;

    // 找到起始模式（支援 "## 第1步", "## 步驟1", "第1步:" 等格式）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (patterns.some(p => line.includes(p))) {
        startIdx = i;
        break;
      }
    }

    if (startIdx === -1) return null;

    // 嘗試找下一個步驟標記 (支援多種格式)
    const nextMarkers = ['## 第', '## 步驟', '**【', '---'];
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

  async updateStepContent(stepId: string, content: string, codeBlock?: string): Promise<void> {
    await prisma.step.update({
      where: { id: stepId },
      data: {
        status: 'running',  // Set to running when content starts updating
        content,
        codeBlock,
        timestamp: new Date(),
      },
    });
    // Invalidate cache when step is updated
    const step = await prisma.step.findUnique({ where: { id: stepId } });
    if (step) {
      this.invalidateSessionCache(step.sessionId);
    }
  }

  async completeStep(stepId: string): Promise<void> {
    // Get sessionId before updating
    const step = await prisma.step.findUnique({ where: { id: stepId } });
    const sessionId = step?.sessionId;

    await prisma.step.update({
      where: { id: stepId },
      data: {
        status: 'success',
        timestamp: new Date(),
      },
    });

    // Invalidate cache when step completes
    if (sessionId) {
      this.invalidateSessionCache(sessionId);
    }
  }

  async completeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });
    // Invalidate cache when session completes
    this.invalidateSessionCache(sessionId);
  }
}

export const ollamaAdapter = new OllamaAdapter();
