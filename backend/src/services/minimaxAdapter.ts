/**
 * MiniMax AI Adapter
 *
 * 需要設定以下環境變數：
 * - MINIMAX_API_KEY: 你的 MiniMax API Key
 * - MINIMAX_API_ENDPOINT: API 端點（預設為 https://api.minimax.chat/v1）
 * - MINIMAX_MODEL: 模型名稱（預設為 MiniMax-M2.7）
 */

import type { AIService, ModuleType, SessionData, MessageData } from './types.js';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_API_ENDPOINT = process.env.MINIMAX_API_ENDPOINT || 'https://api.minimax.chat/v1';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';

interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
    // 建立工作階段
    const sessionId = `session-${Date.now()}`;
    const steps = this.getStepsForModule(module);

    // 初始化步驟資料
    return {
      id: sessionId,
      module,
      input,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps,
      messages: [],
    };
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    // 從資料庫或記憶體取得 session
    return null;
  }

  async getAllSessions(): Promise<SessionData[]> {
    return [];
  }

  async sendMessage(sessionId: string, content: string): Promise<MessageData> {
    // 呼叫 MiniMax API
    const messages: MiniMaxMessage[] = [
      {
        role: 'user',
        content,
      },
    ];

    const response = await this.callMiniMax(messages);

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      createdAt: new Date().toISOString(),
    };
  }

  async getStepStatus(sessionId: string, stepId: string): Promise<import('./types.js').StepData | null> {
    return null;
  }

  private getStepsForModule(module: ModuleType): import('./types.js').StepData[] {
    const stepTemplates: Record<ModuleType, { title: string }[]> = {
      soc: [
        { title: '接收告警' },
        { title: '威脅情報' },
        { title: '攻擊還原' },
        { title: '影響評估' },
        { title: '處置建議' },
      ],
      threat: [
        { title: '收集資料' },
        { title: '擴展線索' },
        { title: '關聯分析' },
        { title: '攻擊路徑' },
        { title: '威脅報告' },
      ],
      pentest: [
        { title: '目標枚舉' },
        { title: '漏洞掃描' },
        { title: '漏洞驗證' },
        { title: '漏洞利用' },
        { title: '報告生成' },
      ],
    };

    return stepTemplates[module].map((step, index) => ({
      id: `step-${Date.now()}-${index}`,
      order: index + 1,
      title: step.title,
      status: 'pending' as const,
    }));
  }
}

export const miniMaxAdapter = new MiniMaxAdapter();
