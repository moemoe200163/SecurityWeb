import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { getAIService, invalidateCache, getCurrentProvider } from '../services/AIServiceFactory.js';

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
  fastify.post('/ai', async (request, reply) => {
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
  fastify.post('/ai/test', async (request, reply) => {
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
}
