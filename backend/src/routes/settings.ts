import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { getAIService, invalidateCache } from '../services/AIServiceFactory.js';
import { checkSsrf } from '../utils/ssrf.js';
import {
  getAllProvidersSafe,
  getProviderConfig,
  saveProviderConfig,
  testProvider,
  type ProviderId,
} from '../services/LLMProviderHealthChecker.js';

const updateAISettingsSchema = z.object({
  provider: z.enum(['minimax', 'ollama']).optional(),
  minimaxApiKey: z.string().optional(),
  minimaxApiEndpoint: z.string().optional(),
  minimaxModel: z.string().optional(),
  ollamaEndpoint: z.string().optional(),
});

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/settings/ai - Get current AI settings
  fastify.get('/ai', async (request, reply) => {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          key: {
            in: ['AI_PROVIDER', 'MINIMAX_API_KEY', 'MINIMAX_API_ENDPOINT', 'MINIMAX_MODEL', 'OLLAMA_ENDPOINT'],
          },
        },
      });

      const result: Record<string, string> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }

      // If no settings exist, return defaults
      if (settings.length === 0) {
        return reply.send({
          provider: 'minimax',
          hasMinimaxKey: false,
          hasOllamaEndpoint: false,
        });
      }

      return reply.send({
        provider: result['AI_PROVIDER'] || 'minimax',
        minimaxApiKey: result['MINIMAX_API_KEY'] ? '(已設定)' : '',
        minimaxApiEndpoint: result['MINIMAX_API_ENDPOINT'] || '',
        minimaxModel: result['MINIMAX_MODEL'] || '',
        ollamaEndpoint: result['OLLAMA_ENDPOINT'] || '',
        hasMinimaxKey: !!(result['MINIMAX_API_KEY']),
        hasOllamaEndpoint: !!result['OLLAMA_ENDPOINT'],
      });
    } catch (error) {
      console.error('Get AI settings error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/settings/ai - Update AI settings
  fastify.post('/ai', { preHandler: [apiKeyAuth, requireAdmin] }, async (request, reply) => {
    try {
      const body = updateAISettingsSchema.parse(request.body);

      // Map settings to database keys
      const settingUpdates: Array<{ key: string; value: string; desc?: string }> = [];

      if (body.provider !== undefined) {
        settingUpdates.push({
          key: 'AI_PROVIDER',
          value: body.provider,
          desc: 'AI provider: minimax | ollama',
        });
      }
      if (body.minimaxApiKey !== undefined) {
        settingUpdates.push({
          key: 'MINIMAX_API_KEY',
          value: body.minimaxApiKey,
          desc: 'MiniMax API key',
        });
      }
      if (body.minimaxApiEndpoint !== undefined) {
        settingUpdates.push({
          key: 'MINIMAX_API_ENDPOINT',
          value: body.minimaxApiEndpoint,
          desc: 'MiniMax API endpoint URL',
        });
      }
      if (body.minimaxModel !== undefined) {
        settingUpdates.push({
          key: 'MINIMAX_MODEL',
          value: body.minimaxModel,
          desc: 'MiniMax model name',
        });
      }
      if (body.ollamaEndpoint !== undefined) {
        settingUpdates.push({
          key: 'OLLAMA_ENDPOINT',
          value: body.ollamaEndpoint,
          desc: 'Ollama server endpoint',
        });
      }

      // Upsert each setting
      for (const update of settingUpdates) {
        await prisma.systemSetting.upsert({
          where: { key: update.key },
          update: { value: update.value, desc: update.desc },
          create: { key: update.key, value: update.value, desc: update.desc },
        });
      }

      // Invalidate cache so next request uses new settings
      invalidateCache();

      return reply.send({
        success: true,
        message: 'AI settings updated successfully',
        updated: settingUpdates.map((u) => u.key),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      console.error('Update AI settings error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/settings/ai/test - Test AI connection
  fastify.post('/ai/test', { preHandler: [apiKeyAuth, requireAdmin, rateLimit(5, 60_000)] }, async (request, reply) => {
    try {
      const body = z.object({
        provider: z.enum(['minimax', 'ollama']).optional(),
        minimaxApiKey: z.string().optional(),
        minimaxApiEndpoint: z.string().optional(),
        ollamaEndpoint: z.string().optional(),
      }).parse(request.body);

      // Get service to test with
      let service;
      if (body.provider === 'ollama' && body.ollamaEndpoint) {
        // Create a temporary test with the specified ollama endpoint
        const { ollamaAdapter } = await import('../services/OllamaAdapter.js');
        // Note: OllamaAdapter would need endpoint configuration
        service = ollamaAdapter;
      } else {
        service = await getAIService();
      }

      // Simple test - try to get a session to verify connection
      const testResult = await service.startAnalysis('soc', {
        type: 'simulation',
        rawContent: 'Test connection',
      });

      return reply.send({
        success: true,
        message: 'AI connection test successful',
        sessionId: testResult.id,
      });
    } catch (error) {
      console.error('AI connection test error:', error);
      return reply.status(500).send({
        success: false,
        error: 'AI connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ─── LLM Provider Management ──────────────────────────────────────

  const VALID_PROVIDER_IDS = ['minimax', 'openai', 'anthropic', 'xiaomi', 'ollama'] as const;

  // GET /api/settings/llm/providers - List all providers (safe metadata, no secrets)
  fastify.get('/llm/providers', { preHandler: [apiKeyAuth] }, async (_request, reply) => {
    try {
      const providers = await getAllProvidersSafe();
      const activeSetting = await prisma.systemSetting.findUnique({ where: { key: 'LLM_PROVIDER' } });
      return reply.send({ providers, active: activeSetting?.value || 'minimax' });
    } catch (error) {
      console.error('Get LLM providers error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/settings/llm/providers/:provider - Update provider config (admin only)
  fastify.put<{ Params: { provider: string } }>('/llm/providers/:provider', { preHandler: [apiKeyAuth, requireAdmin] }, async (request, reply) => {
    const { provider } = request.params;
    if (!VALID_PROVIDER_IDS.includes(provider as ProviderId)) {
      return reply.status(400).send({ error: `Invalid provider. Must be one of: ${VALID_PROVIDER_IDS.join(', ')}` });
    }

    try {
      const body = z.object({
        baseUrl: z.string().url().optional(),
        model: z.string().min(1).optional(),
        apiKey: z.string().optional(),
        enabled: z.boolean().optional(),
      }).parse(request.body);

      // P0-4 SSRF guard: even an admin-supplied baseUrl must not point to
      // private/loopback IP space, otherwise a stolen admin key could pivot
      // the LLM traffic to an internal address and exfiltrate
      // messages/raw_content through the outbound request body.
      if (body.baseUrl !== undefined) {
        const ssrf = await checkSsrf(body.baseUrl, { label: 'baseUrl' });
        if (!ssrf.ok) {
          return reply.status(400).send({
            error: 'baseUrl points to a disallowed host',
            details: [{ field: 'baseUrl', message: ssrf.reason ?? 'blocked' }],
          });
        }
      }

      const config = await getProviderConfig(provider as ProviderId);
      if (body.baseUrl !== undefined) config.baseUrl = body.baseUrl;
      if (body.model !== undefined) config.model = body.model;
      if (body.apiKey !== undefined) config.apiKey = body.apiKey;
      if (body.enabled !== undefined) config.enabled = body.enabled;

      await saveProviderConfig(config);
      invalidateCache();

      // Return safe metadata (no secrets)
      const safe = await getAllProvidersSafe();
      const updated = safe.find((p) => p.id === provider);
      return reply.send({ success: true, provider: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      console.error(`Update LLM provider ${provider} error:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/settings/llm/providers/:provider/test - Health check (admin only, rate limited)
  fastify.post<{ Params: { provider: string } }>('/llm/providers/:provider/test', { preHandler: [apiKeyAuth, requireAdmin, rateLimit(10, 60_000)] }, async (request, reply) => {
    const { provider } = request.params;
    if (!VALID_PROVIDER_IDS.includes(provider as ProviderId)) {
      return reply.status(400).send({ error: `Invalid provider. Must be one of: ${VALID_PROVIDER_IDS.join(', ')}` });
    }

    try {
      const result = await testProvider(provider as ProviderId);

      // Persist health check result
      await prisma.systemSetting.upsert({
        where: { key: `LLM_${provider.toUpperCase()}_LAST_TEST` },
        update: { value: JSON.stringify({ status: result.status, ok: result.ok, latencyMs: result.latencyMs, checkedAt: result.checkedAt, message: result.message, safeError: result.safeError }) },
        create: { key: `LLM_${provider.toUpperCase()}_LAST_TEST`, value: JSON.stringify({ status: result.status, ok: result.ok, latencyMs: result.latencyMs, checkedAt: result.checkedAt, message: result.message, safeError: result.safeError }), desc: `Last health check for ${provider}` },
      });

      return reply.send(result);
    } catch (error) {
      console.error(`Test LLM provider ${provider} error:`, error);
      return reply.status(500).send({ error: 'Health check failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /api/settings/llm/providers/:provider/select - Set as active provider (admin only)
  fastify.post<{ Params: { provider: string } }>('/llm/providers/:provider/select', { preHandler: [apiKeyAuth, requireAdmin] }, async (request, reply) => {
    const { provider } = request.params;
    if (!VALID_PROVIDER_IDS.includes(provider as ProviderId)) {
      return reply.status(400).send({ error: `Invalid provider. Must be one of: ${VALID_PROVIDER_IDS.join(', ')}` });
    }

    try {
      await prisma.systemSetting.upsert({
        where: { key: 'LLM_PROVIDER' },
        update: { value: provider, desc: 'Active LLM provider' },
        create: { key: 'LLM_PROVIDER', value: provider, desc: 'Active LLM provider' },
      });

      // Also update legacy AI_PROVIDER for backward compat
      await prisma.systemSetting.upsert({
        where: { key: 'AI_PROVIDER' },
        update: { value: provider, desc: 'AI provider (legacy)' },
        create: { key: 'AI_PROVIDER', value: provider, desc: 'AI provider (legacy)' },
      });

      invalidateCache();
      return reply.send({ success: true, active: provider });
    } catch (error) {
      console.error(`Select LLM provider ${provider} error:`, error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/settings/llm/active - Get active provider safe metadata
  fastify.get('/llm/active', { preHandler: [apiKeyAuth] }, async (_request, reply) => {
    try {
      const activeSetting = await prisma.systemSetting.findUnique({ where: { key: 'LLM_PROVIDER' } });
      const activeId = (activeSetting?.value || 'minimax') as ProviderId;
      const config = await getProviderConfig(activeId);
      return reply.send({
        id: config.id,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        model: config.model,
        hasKey: !!config.apiKey,
        keyPreview: config.apiKey ? config.apiKey.slice(0, 4) + '••••' + config.apiKey.slice(-4) : null,
      });
    } catch (error) {
      console.error('Get active LLM provider error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
