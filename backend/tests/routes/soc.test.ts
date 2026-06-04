import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

// Cleanup sessions created during tests
let createdSessionIds: string[] = [];

afterAll(async () => {
  for (const id of createdSessionIds) {
    try {
      await prisma.session.delete({ where: { id } });
    } catch {}
  }
  await prisma.$disconnect();
});

describe('P0.2a: /api/soc auth + rate limit', () => {
  it('POST /analyze returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/soc/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'simulation', rawContent: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /analyze returns 401 with invalid key', async () => {
    const res = await api(
      'POST',
      '/api/soc/analyze',
      { type: 'simulation', rawContent: 'test' },
      { 'X-API-Key': 'sk-invalid' },
    );
    expect(res.status).toBe(401);
  });

  it('POST /analyze returns 201 with valid key (simulation mode)', async () => {
    const res = await api('POST', '/api/soc/analyze', {
      type: 'simulation',
      rawContent: 'test alert payload',
    });
    expect(res.status).toBe(201);
    expect(res.data.sessionId).toBeDefined();
    createdSessionIds.push(res.data.sessionId);
  });

  it('GET /sessions returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/soc/sessions`);
    expect(res.status).toBe(401);
  });

  it('GET /sessions returns 200 with valid key', async () => {
    const res = await api('GET', '/api/soc/sessions');
    expect(res.status).toBe(200);
    expect(res.data.sessions).toBeDefined();
  });

  it('POST /sessions/:id/messages returns 401 without X-API-Key', async () => {
    // Need a valid session id; create one first
    const createRes = await api('POST', '/api/soc/analyze', {
      type: 'simulation',
      rawContent: 'test',
    });
    const sessionId = createRes.data.sessionId;
    createdSessionIds.push(sessionId);

    const res = await fetch(`${API_BASE}/api/soc/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});
