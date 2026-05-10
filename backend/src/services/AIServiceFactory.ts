/**
 * AIServiceFactory - 工廠函式，根據資料庫設定回傳對應的 AIService
 */

import { prisma } from '../db/client.js';
import { miniMaxAdapter } from './minimaxAdapter.js';
import { ollamaAdapter } from './OllamaAdapter.js';
import type { AIService } from './types.js';

// 快取機制
let cachedProvider: string | null = null;
let cacheTimeout: number = 0;
const CACHE_TTL_MS = 5000; // 5 秒快取

export async function getAIService(): Promise<AIService> {
  const now = Date.now();
  if (cachedProvider && now < cacheTimeout) {
    return cachedProvider === 'ollama' ? ollamaAdapter : miniMaxAdapter;
  }

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

export async function getCurrentProvider(): Promise<string> {
  if (cachedProvider && Date.now() < cacheTimeout) {
    return cachedProvider;
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'AI_PROVIDER' }
  });

  return setting?.value || 'minimax';
}