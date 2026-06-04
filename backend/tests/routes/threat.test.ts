import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_KEY } from '../setup.js';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:4000';
const prisma = new PrismaClient();

async function api(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; data: any }> {
  const reqHeaders: Record<string, string> = {
    'X-API-Key': TEST_API_KEY,
    ...headers,
  };
  if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

let createdSessionIds: string[] = [];

afterAll(async () => {
  for (const id of createdSessionIds) {
    try {
      await prisma.session.delete({ where: { id } });
    } catch {}
  }
  await prisma.$disconnect();
});

describe('P0.2b: /api/threat auth + rate limit', () => {
  it('POST /investigate returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/threat/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ip', value: '1.2.3.4' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /investigate returns 201 with valid key', async () => {
    const res = await api('POST', '/api/threat/investigate', {
      type: 'ip',
      value: '1.2.3.4',
    });
    expect(res.status).toBe(201);
    expect(res.data.sessionId).toBeDefined();
    createdSessionIds.push(res.data.sessionId);
  });

  it('GET /sessions returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/threat/sessions`);
    expect(res.status).toBe(401);
  });

  it('GET /sessions returns 200 with valid key', async () => {
    const res = await api('GET', '/api/threat/sessions');
    expect(res.status).toBe(200);
    expect(res.data.sessions).toBeDefined();
  });

  it('POST /sessions/:id/messages returns 401 without X-API-Key', async () => {
    const createRes = await api('POST', '/api/threat/investigate', {
      type: 'ip',
      value: '1.2.3.4',
    });
    const sessionId = createRes.data.sessionId;
    createdSessionIds.push(sessionId);

    const res = await fetch(`${API_BASE}/api/threat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});
