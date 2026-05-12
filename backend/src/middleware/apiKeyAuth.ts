import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      api_key: string;
      role: 'user' | 'admin';
    };
  }
}

export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    return reply.status(401).send({
      error: 'API key required',
      message: 'Please provide X-API-Key header',
    });
  }

  if (typeof apiKey !== 'string' || apiKey.length !== 64) {
    return reply.status(401).send({
      error: 'Invalid API key format',
    });
  }

  try {
    const result = await db.query(
      'SELECT id, api_key, role FROM users WHERE api_key = $1',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return reply.status(401).send({
        error: 'Invalid API key',
      });
    }

    request.user = result.rows[0];
  } catch (error) {
    console.error('API key auth error:', error);
    return reply.status(500).send({
      error: 'Authentication failed',
    });
  }
}