/**
 * AIServiceFactory - 工廠函式，根據資料庫設定回傳對應的 AIService
 * 支援 fallback 鏈：優先嘗試設定的 provider，若失敗則嘗試備用方案
 */

import { prisma } from '../db/client.js';
import { miniMaxAdapter } from './minimaxAdapter.js';
import { ollamaAdapter } from './OllamaAdapter.js';
import type { AIService } from './types.js';

// 快取機制
let cachedProvider: string | null = null;
let cacheTimeout: number = 0;
const CACHE_TTL_MS = 5000; // 5 秒快取

// Provider 優先順序
type ProviderType = 'minimax' | 'ollama' | 'mock';

const providerAdapters: Record<ProviderType, AIService> = {
  minimax: miniMaxAdapter,
  ollama: ollamaAdapter,
  mock: createMockAdapter(),
};

export async function getAIService(preferredProvider?: ProviderType): Promise<AIService> {
  // 如果有指定 provider，直接使用（用於 fallback 場景）
  if (preferredProvider && providerAdapters[preferredProvider]) {
    return providerAdapters[preferredProvider];
  }

  const now = Date.now();
  if (cachedProvider && now < cacheTimeout) {
    return providerAdapters[cachedProvider as ProviderType] || providerAdapters.minimax;
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'AI_PROVIDER' }
  });

  cachedProvider = setting?.value || 'minimax';
  cacheTimeout = now + CACHE_TTL_MS;

  return providerAdapters[cachedProvider as ProviderType] || providerAdapters.minimax;
}

/**
 * 嘗試取得可用的 AI Service，支援 fallback
 * 優先嘗試設定的 provider，若失敗則嘗試備用方案
 */
export async function getAIServiceWithFallback(primaryProvider?: ProviderType): Promise<AIService> {
  const providers: ProviderType[] = primaryProvider
    ? [primaryProvider, 'ollama', 'minimax', 'mock']
    : ['ollama', 'minimax', 'mock'];

  for (const provider of providers) {
    try {
      const adapter = providerAdapters[provider];
      // 簡單的健康檢查 - 嘗試獲取一個 session
      // 如果 adapter 不可用會拋出錯誤
      await adapter.getAllSessions();
      console.log(`[AIServiceFactory] Using provider: ${provider}`);
      return adapter;
    } catch (error) {
      console.warn(`[AIServiceFactory] Provider ${provider} failed:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }

  // 理論上不應該走到這裡，因為 mock 是最後備用
  console.error('[AIServiceFactory] All providers failed, using mock');
  return providerAdapters.mock;
}

export function invalidateCache(): void {
  cachedProvider = null;
  cacheTimeout = 0;
}

/**
 * 建立 Mock AI Adapter - 用於無可用 AI 時的降級方案
 */
function createMockAdapter(): AIService {
  return {
    async startAnalysis(module: string, input: unknown) {
      return {
        id: `mock-session-${Date.now()}`,
        module: module as 'soc' | 'threat' | 'pentest',
        input,
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [],
        messages: [],
      };
    },
    async getSession(sessionId: string) {
      return null;
    },
    async getAllSessions() {
      return [];
    },
    async sendMessage(sessionId: string, content: string) {
      return {
        id: `mock-msg-${Date.now()}`,
        role: 'assistant',
        content: `[Mock Response] 收到訊息: ${content}\n\n⚠️ 目前無可用的 AI 服務，請聯絡管理員設定 MINIMAX_API_KEY 或啟動 Ollama。`,
        createdAt: new Date().toISOString(),
      };
    },
    async getStepStatus(sessionId: string, stepId: string) {
      return null;
    },
    async updateStepContent(stepId: string, content: string) {},
    async completeStep(stepId: string) {},
    async completeSession(sessionId: string) {},
  };
}
