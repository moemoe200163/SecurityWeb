import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/client.js';
import { hashApiKey, isValidKeyFormat, extractPrefix } from '../utils/keyHash.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

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
 * 3. Look up user by keyPrefix
 * 4. Reject if user has no key set, key is revoked, or key is expired
 * 5. Verify hashedKey matches computed hash
 *
 * Failures (revoked/expired/hash mismatch) write an audit_log entry
 * with reason but return generic "Invalid API key" to the client.
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
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  try {
    const prefix = extractPrefix(apiKey);
    const hashed = hashApiKey(apiKey);

    const user = await prisma.user.findUnique({
      where: { keyPrefix: prefix },
      select: {
        id: true,
        hashedKey: true,
        keyRevokedAt: true,
        keyExpiresAt: true,
        role: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    // Lifecycle checks
    if (user.hashedKey === null) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'auth_denied',
          resourceType: 'api_key',
          details: sanitizeAuditDetails({ reason: 'no_key', prefix }),
        },
      });
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    if (user.keyRevokedAt !== null) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'auth_denied',
          resourceType: 'api_key',
          details: sanitizeAuditDetails({ reason: 'revoked_key', prefix }),
        },
      });
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    const now = new Date();
    if (user.keyExpiresAt !== null && user.keyExpiresAt <= now) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'auth_denied',
          resourceType: 'api_key',
          details: sanitizeAuditDetails({
            reason: 'expired_key',
            prefix,
            expiredAt: user.keyExpiresAt.toISOString(),
          }),
        },
      });
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    if (user.hashedKey !== hashed) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'auth_denied',
          resourceType: 'api_key',
          details: sanitizeAuditDetails({ reason: 'hash_mismatch', prefix }),
        },
      });
      return reply.status(401).send({ error: 'Invalid API key' });
    }

    request.user = {
      id: user.id,
      keyPrefix: prefix,
      role: user.role as 'user' | 'admin',
    };
  } catch (error) {
    request.log.error({ err: error }, 'API key auth error');
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}
