import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_KEY, TEST_USER_ID } from './setup.js';
import { hashApiKey, extractPrefix, generateApiKey } from '../src/utils/keyHash.js';

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

let tempUserId: string;
let tempUserKey: string;

beforeAll(async () => {
  const { plaintext, prefix, hashed } = generateApiKey();
  tempUserId = `me-test-${Date.now()}`;
  tempUserKey = plaintext;
  await prisma.user.create({
    data: {
      id: tempUserId,
      keyPrefix: prefix,
      hashedKey: hashed,
      keyCreatedAt: new Date(),
      role: 'user',
    },
  });
});

afterAll(async () => {
  // Audit logs must be deleted before users (FK constraint: audit_logs.user_id -> users.id, NOT NULL).
  await prisma.auditLog.deleteMany({ where: { resourceId: tempUserId } });
  await prisma.auditLog.deleteMany({ where: { userId: tempUserId } });
  await prisma.user.deleteMany({ where: { id: tempUserId } });
  await prisma.$disconnect();
});

describe('W19.1: /api/me/api-key (self-service)', () => {
  it('GET /api/me/api-key returns my key metadata', async () => {
    const res = await api('GET', '/api/me/api-key', undefined, tempUserKey);
    expect(res.status).toBe(200);
    expect(res.data.prefix).toMatch(/^sk-[a-f0-9]{8}$/);
  });

  it('POST /api/me/api-key/rotate returns plaintext once and DB has new hash', async () => {
    const res = await api('POST', '/api/me/api-key/rotate', undefined, tempUserKey);
    expect(res.status).toBe(200);
    expect(res.data.plaintext).toMatch(/^sk-[a-f0-9]{64}$/);

    // New key works
    const newKeyRes = await api('GET', '/api/me/api-key', undefined, res.data.plaintext);
    expect(newKeyRes.status).toBe(200);

    // Old key is rejected
    const oldKeyRes = await api('GET', '/api/me/api-key', undefined, tempUserKey);
    expect(oldKeyRes.status).toBe(401);
  });
});
