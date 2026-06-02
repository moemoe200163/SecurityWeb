import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';
import { hashApiKey, isValidKeyFormat, extractPrefix } from '../utils/keyHash.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      keyPrefix: string;
      role: 'user' | 'admin';
    };
  }
}

/**
 * Authenticate requests via X-API-Key header.
 *
 * Flow:
 * 1. Extract full key from header
 * 2. Validate format (sk- + 64 hex chars = 67 total)
 * 3. Hash the full key with SHA-256
 * 4. Look up user by keyPrefix (first 11 chars)
 * 5. Verify hashedKey matches the computed hash
 */
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

  if (!isValidKeyFormat(apiKey)) {
    return reply.status(401).send({
      error: 'Invalid API key format',
    });
  }

  try {
    const prefix = extractPrefix(apiKey);
    const hashed = hashApiKey(apiKey);

    const user = await prisma.user.findUnique({
      where: { keyPrefix: prefix },
      select: { id: true, hashedKey: true, role: true },
    });

    if (!user || user.hashedKey !== hashed) {
      return reply.status(401).send({
        error: 'Invalid API key',
      });
    }

    request.user = {
      id: user.id,
      keyPrefix: prefix,
      role: user.role as 'user' | 'admin',
    };
  } catch (error) {
    console.error('API key auth error:', error);
    return reply.status(500).send({
      error: 'Authentication failed',
    });
  }
}
