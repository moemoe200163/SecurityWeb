import type { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
  listAllApiKeys,
  rotateUserApiKey,
  revokeUserApiKey,
} from '../services/apiKeyService.js';

export async function adminKeysRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/admin/keys — list all user keys
  fastify.get(
    '/keys',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (_request, reply) => {
      try {
        const keys = await listAllApiKeys();
        return reply.send({ keys });
      } catch (error) {
        _request.log.error({ err: error }, 'list keys failed');
        return reply.status(500).send({ error: 'Failed to list keys' });
      }
    }
  );

  // POST /api/admin/keys/:userId/rotate — force rotate a user key
  fastify.post(
    '/keys/:userId/rotate',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const adminId = request.user!.id;
      try {
        const result = await rotateUserApiKey(userId, adminId);
        return reply.send(result);
      } catch (error) {
        request.log.error({ err: error }, 'rotate user key failed');
        return reply.status(500).send({ error: 'Failed to rotate key' });
      }
    }
  );

  // DELETE /api/admin/keys/:userId — revoke a user key
  fastify.delete(
    '/keys/:userId',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const adminId = request.user!.id;
      try {
        await revokeUserApiKey(userId, adminId, 'admin_revoke');
        return reply.status(204).send();
      } catch (error) {
        request.log.error({ err: error }, 'revoke user key failed');
        return reply.status(500).send({ error: 'Failed to revoke key' });
      }
    }
  );
}
