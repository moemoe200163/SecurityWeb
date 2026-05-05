/**
 * MiniMax AI Adapter - 完整實現
 *
 * 使用 MiniMax LLM 進行真實 AI 對話
 */

import { prisma } from '../db/client.js';
import type { AIService, ModuleType, SessionData, StepData, MessageData } from './types.js';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_ENDPOINT = process.env.MINIMAX_API_ENDPOINT || 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

// SOC 分析的 system prompt
const SOC_SYSTEM_PROMPT = `你是一個資深安全事件響應專家，專精於 SOC 告警分析。

當用戶提交安全告警時，請按照以下固定格式分析並生成專業報告：

【輸出格式】
1. 事件概要
2. 關鍵指標（IOCs）- 使用表格
3. 攻擊過程還原 - 使用表格
4. MITRE ATT&CK 映射 - 使用表格
5. 技術分析
6. 威脅情報評估
7. 業務影響評估 - 使用表格
8. 根本原因分析
9. 處置建議（分為【立即動作】【短期加固】【長期改善】）
10. 總結與風險等級

要求：
- 專業、客觀、結構清晰
- 善用表格提升可讀性
- 若資訊不足，明確標註「建議補充 XXX 資訊」`;

// 威脅情報的 system prompt
const THREAT_SYSTEM_PROMPT = `你是一個專業的威脅情報分析師，擅長數位威脅情報調查與分析。

當用戶輸入 IP、域名或雜湊值時，請：
1. 分析該威脅指標的特徵
2. 關聯相關威脅情報
3. 提供攻擊者行為模式
4. 繪製攻擊路徑
5. 生成詳細的威脅報告

輸出格式：
1. 指標概況
2. 威脅評估
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

export class MiniMaxAdapter implements AIService {
  private async callMiniMax(messages: MiniMaxMessage[]): Promise<string> {
    if (!MINIMAX_API_KEY) {
      throw new Error('MINIMAX_API_KEY environment variable is not set');
    }

    const response = await fetch(`${MINIMAX_API_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
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
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) return null;
    return formatSession(session);
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
    // 取得 session 以獲取對話歷史
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // 儲存用戶訊息
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    // 建構 MiniMax 訊息列表
    const systemPrompt = session.module === 'soc'
      ? SOC_SYSTEM_PROMPT
      : session.module === 'threat'
      ? THREAT_SYSTEM_PROMPT
      : '你是一個專業的滲透測試助手，擅長協助安全測試。';

    const miniMaxMessages: MiniMaxMessage[] = [
      { role: 'system', content: systemPrompt },
      ...session.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content },
    ];

    // 呼叫 MiniMax API
    const aiResponse = await this.callMiniMax(miniMaxMessages);

    // 儲存 AI 回應
    const aiMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponse,
      },
    });

    return {
      id: aiMessage.id,
      role: 'assistant',
      content: aiMessage.content,
      createdAt: aiMessage.createdAt.toISOString(),
    };
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
        content,
        codeBlock,
        timestamp: new Date(),
      },
    });
  }

  async completeStep(stepId: string): Promise<void> {
    await prisma.step.update({
      where: { id: stepId },
      data: {
        status: 'success',
        timestamp: new Date(),
      },
    });
  }

  async completeSession(sessionId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });
  }
}

export const miniMaxAdapter = new MiniMaxAdapter();
