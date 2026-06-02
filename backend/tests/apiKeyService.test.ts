import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  getMyApiKey,
  rotateMyApiKey,
  listAllApiKeys,
  rotateUserApiKey,
  revokeUserApiKey,
} from '../src/services/apiKeyService.js';

const prisma = new PrismaClient();
const TEST_USER_IDS: string[] = [];

async function createUser(role: 'user' | 'admin' = 'user'): Promise<string> {
  const id = `svc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  TEST_USER_IDS.push(id);
  await prisma.user.create({
    data: { id, role },
  });
  return id;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userId: { in: TEST_USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: TEST_USER_IDS } } });
  await prisma.$disconnect();
});

describe('apiKeyService.getMyApiKey', () => {
  it('returns null metadata when user has no key', async () => {
    const id = await createUser();
    const meta = await getMyApiKey(id);
    expect(meta.prefix).toBeNull();
    expect(meta.createdAt).toBeNull();
  });
});

describe('apiKeyService.rotateMyApiKey', () => {
  it('returns plaintext once and stores hash/prefix in DB', async () => {
    const id = await createUser();
    const result = await rotateMyApiKey(id);

    expect(result.plaintext).toMatch(/^sk-[a-f0-9]{64}$/);
    expect(result.metadata.prefix).toMatch(/^sk-[a-f0-9]{8}$/);

    const dbUser = await prisma.user.findUnique({ where: { id } });
    expect(dbUser?.hashedKey).toMatch(/^[a-f0-9]{64}$/);
    expect(dbUser?.keyPrefix).toBe(result.metadata.prefix);
    expect(dbUser?.keyRevokedAt).toBeNull();
  });

  it('writes a rotate_key audit log entry', async () => {
    const id = await createUser();
    await rotateMyApiKey(id);
    const log = await prisma.auditLog.findFirst({
      where: { userId: id, action: 'rotate_key' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
  });
});

describe('apiKeyService.listAllApiKeys', () => {
  it('returns all users with their key metadata', async () => {
    const id = await createUser('admin');
    const list = await listAllApiKeys();
    expect(list.length).toBeGreaterThanOrEqual(1);
    const me = list.find((k) => k.user.id === id);
    expect(me).toBeDefined();
    expect(me?.user.role).toBe('admin');
  });
});

describe('apiKeyService.revokeUserApiKey', () => {
  it('sets keyPrefix/hashedKey to null and keyRevokedAt to now', async () => {
    const id = await createUser();
    await rotateMyApiKey(id);
    const adminId = 'test-admin';
    await revokeUserApiKey(id, adminId, 'test');

    const dbUser = await prisma.user.findUnique({ where: { id } });
    expect(dbUser?.keyPrefix).toBeNull();
    expect(dbUser?.hashedKey).toBeNull();
    expect(dbUser?.keyRevokedAt).not.toBeNull();
  });

  it('writes revoke_key audit log entry', async () => {
    const id = await createUser();
    await rotateMyApiKey(id);
    await revokeUserApiKey(id, 'test-admin');
    const log = await prisma.auditLog.findFirst({
      where: { userId: 'test-admin', action: 'revoke_key' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
  });
});

describe('apiKeyService.rotateUserApiKey', () => {
  it('admin can rotate another users key', async () => {
    const targetId = await createUser();
    const adminId = 'test-admin';
    const result = await rotateUserApiKey(targetId, adminId);
    expect(result.plaintext).toMatch(/^sk-[a-f0-9]{64}$/);
  });
});
