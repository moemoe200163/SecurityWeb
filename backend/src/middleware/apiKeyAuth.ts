import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      apiKey: string;
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
    const user = await prisma.user.findUnique({
      where: { apiKey },
      select: { id: true, apiKey: true, role: true }
    });

    if (!user) {
      return reply.status(401).send({
        error: 'Invalid API key',
      });
    }

    request.user = {
      id: user.id,
      apiKey: user.apiKey,
      role: user.role as 'user' | 'admin',
    };
  } catch (error) {
    console.error('API key auth error:', error);
    return reply.status(500).send({
      error: 'Authentication failed',
    });
  }
}