import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_KEY } from './setup.js';
import { generateApiKey } from '../src/utils/keyHash.js';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:4000';
const prisma = new PrismaClient();

async function api(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  apiKey = TEST_API_KEY
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'X-API-Key': apiKey };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const tempUserIds: string[] = [];
async function createUserWithKey(): Promise<{ id: string; plaintext: string }> {
  const { plaintext, prefix, hashed } = generateApiKey();
  const id = `admintest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  tempUserIds.push(id);
  await prisma.user.create({
    data: { id, keyPrefix: prefix, hashedKey: hashed, keyCreatedAt: new Date(), role: 'user' },
  });
  return { id, plaintext };
}

beforeAll(async () => {
  // Sanity: the API must be reachable before running real assertions.
  const health = await fetch(`${API_BASE}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `Backend not reachable at ${API_BASE}. Start it (e.g. docker compose --profile dev up -d backend) before running tests.`,
    );
  }
});

afterAll(async () => {
  // Audit logs must be deleted before users (FK constraint: audit_logs.user_id -> users.id, NOT NULL).
  // The "DELETE then old key" test causes apiKeyAuth to write an auth_denied log with
  // userId pointing at the target user, which would block the subsequent user.deleteMany.
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: tempUserIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: tempUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: tempUserIds } } });
  await prisma.$disconnect();
});

describe('W19.1: /api/admin/keys', () => {
  it('GET /api/admin/keys returns all users (admin only)', async () => {
    await createUserWithKey();
    const res = await api('GET', '/api/admin/keys');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.keys)).toBe(true);
  });

  it('POST /api/admin/keys/:userId/rotate rotates target user key', async () => {
    const { id, plaintext } = await createUserWithKey();
    const res = await api('POST', `/api/admin/keys/${id}/rotate`);
    expect(res.status).toBe(200);
    expect(res.data.plaintext).toMatch(/^sk-[a-f0-9]{64}$/);
    expect(res.data.plaintext).not.toBe(plaintext);
  });

  it('DELETE /api/admin/keys/:userId revokes target user key', async () => {
    const { id, plaintext } = await createUserWithKey();
    const delRes = await api('DELETE', `/api/admin/keys/${id}`);
    expect(delRes.status).toBe(204);

    // Verify old key is now rejected
    const checkRes = await api('GET', '/api/admin/keys', undefined, plaintext);
    expect(checkRes.status).toBe(401);
  });

  it('DELETE on already-revoked is 204 no-op', async () => {
    const { id } = await createUserWithKey();
    await api('DELETE', `/api/admin/keys/${id}`);
    const res = await api('DELETE', `/api/admin/keys/${id}`);
    expect(res.status).toBe(204);
  });
});
