import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { hashApiKey, extractPrefix, generateApiKey } from '../src/utils/keyHash.js';
import { apiKeyAuth } from '../src/middleware/apiKeyAuth.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

const prisma = new PrismaClient();

function mockReq(apiKey: string | undefined): FastifyRequest {
  return { headers: apiKey ? { 'x-api-key': apiKey } : {} } as unknown as FastifyRequest;
}

function mockReply() {
  const reply = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
  return reply as unknown as FastifyReply;
}

async function createUserWithState(state: { revoked?: boolean; expired?: boolean; noKey?: boolean }): Promise<string> {
  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { plaintext, prefix, hashed } = generateApiKey();
  const now = new Date();
  await prisma.user.create({
    data: {
      id,
      keyPrefix: state.noKey ? null : prefix,
      hashedKey: state.noKey ? null : hashed,
      keyCreatedAt: state.noKey ? null : now,
      keyRevokedAt: state.revoked ? now : null,
      keyExpiresAt: state.expired ? new Date(now.getTime() - 1000) : null,
      role: 'user',
    },
  });
  return plaintext;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { user: { id: { startsWith: 'test-' } } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: 'test-' } } });
  await prisma.$disconnect();
});

describe('apiKeyAuth middleware', () => {
  it('rejects revoked key with 401', async () => {
    const key = await createUserWithState({ revoked: true });
    const reply = mockReply();
    await apiKeyAuth(mockReq(key), reply);
    expect(reply.statusCode).toBe(401);
  });

  it('rejects expired key with 401', async () => {
    const key = await createUserWithState({ expired: true });
    const reply = mockReply();
    await apiKeyAuth(mockReq(key), reply);
    expect(reply.statusCode).toBe(401);
  });

  it('rejects user with no key set with 401', async () => {
    const key = 'sk-' + 'f'.repeat(64);
    await prisma.user.create({
      data: { id: `test-nokey-${Date.now()}`, keyPrefix: null, hashedKey: null, role: 'user' },
    });
    const reply = mockReply();
    await apiKeyAuth(mockReq(key), reply);
    expect(reply.statusCode).toBe(401);
  });

  it('accepts valid key with 200 (no reply sent) and attaches user', async () => {
    const key = await createUserWithState({});
    const req = mockReq(key);
    const reply = mockReply();
    await apiKeyAuth(req, reply);
    expect(req.user).toBeDefined();
    expect(req.user!.role).toBe('user');
  });
});
