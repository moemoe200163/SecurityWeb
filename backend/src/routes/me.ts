import type { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { getMyApiKey, rotateMyApiKey } from '../services/apiKeyService.js';

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/me/api-key — get my key metadata
  fastify.get(
    '/api-key',
    { preHandler: [apiKeyAuth] },
    async (request, reply) => {
      const meta = await getMyApiKey(request.user!.id);
      return reply.send(meta);
    }
  );

  // POST /api/me/api-key/rotate — rotate my own key
  fastify.post(
    '/api-key/rotate',
    { preHandler: [apiKeyAuth] },
    async (request, reply) => {
      try {
        const result = await rotateMyApiKey(request.user!.id);
        return reply.send(result);
      } catch (error) {
        request.log.error({ err: error }, 'rotate own key failed');
        return reply.status(500).send({ error: 'Failed to rotate key' });
      }
    }
  );
}
