import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateApiKey } from '../src/utils/keyHash.js';
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

async function createUserWithState(state: { revoked?: boolean; expired?: boolean; noKey?: boolean }): Promise<{ plaintext: string; userId: string }> {
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
  return { plaintext, userId: id };
}

async function seedUserWithPrefixButNoHash(): Promise<{ userId: string; prefix: string }> {
  const id = `test-nokey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // Use a unique prefix per run (8 hex chars) so repeated runs don't trip the
  // `key_prefix` unique constraint when afterAll doesn't run (e.g. --bail).
  const prefix = `sk-${Date.now().toString(16).padStart(8, '0').slice(-8)}`;
  await prisma.user.create({
    data: { id, keyPrefix: prefix, hashedKey: null, role: 'user' },
  });
  return { userId: id, prefix };
}

afterAll(async () => {
  // Delete audit logs and users by id range. The relation filter
  // `user: { id: { startsWith: 'test-' } }` skips logs whose userId points
  // at a deleted user, so we filter directly on `userId` here. Exclude
  // `test-admin` (the global setup's admin fixture used by api.test.ts).
  await prisma.auditLog.deleteMany({
    where: { userId: { startsWith: 'test-', not: 'test-admin' } },
  });
  await prisma.user.deleteMany({
    where: { id: { startsWith: 'test-', not: 'test-admin' } },
  });
  await prisma.$disconnect();
});

describe('apiKeyAuth middleware', () => {
  it('rejects revoked key with 401 and writes audit log', async () => {
    const { plaintext, userId } = await createUserWithState({ revoked: true });
    const reply = mockReply();
    await apiKeyAuth(mockReq(plaintext), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ error: 'Invalid API key' });

    const log = await prisma.auditLog.findFirst({
      where: { userId, action: 'auth_denied', resourceType: 'api_key' },
    });
    expect(log).not.toBeNull();
    expect((log!.details as { reason: string }).reason).toBe('revoked_key');
  });

  it('rejects expired key with 401 and writes audit log', async () => {
    const { plaintext, userId } = await createUserWithState({ expired: true });
    const reply = mockReply();
    await apiKeyAuth(mockReq(plaintext), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ error: 'Invalid API key' });

    const log = await prisma.auditLog.findFirst({
      where: { userId, action: 'auth_denied', resourceType: 'api_key' },
    });
    expect(log).not.toBeNull();
    expect((log!.details as { reason: string }).reason).toBe('expired_key');
  });

  it('rejects user with prefix but no hashed key with 401 and writes audit log', async () => {
    // Seed a user whose keyPrefix matches a real key but whose hashedKey is null.
    // This exercises the no_key branch (user found, hashedKey is null).
    const { userId, prefix } = await seedUserWithPrefixButNoHash();
    // Build a valid-format key (sk- + 64 hex = 67 chars) that starts with the prefix.
    // The hash is irrelevant since the branch returns 401 before hash comparison.
    const apiKey = `${prefix}${'a'.repeat(67 - prefix.length)}`;
    const reply = mockReply();
    await apiKeyAuth(mockReq(apiKey), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({ error: 'Invalid API key' });

    const log = await prisma.auditLog.findFirst({
      where: { userId, action: 'auth_denied', resourceType: 'api_key' },
    });
    expect(log).not.toBeNull();
    expect((log!.details as { reason: string }).reason).toBe('no_key');
  });

  it('accepts valid key with 200 (no reply sent) and attaches user', async () => {
    const { plaintext } = await createUserWithState({});
    const req = mockReq(plaintext);
    const reply = mockReply();
    await apiKeyAuth(req, reply);
    expect(reply.statusCode).toBe(200);
    expect(req.user).toBeDefined();
    expect(req.user!.role).toBe('user');
  });
});
