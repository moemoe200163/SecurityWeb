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

afterAll(async () => {
  await prisma.$disconnect();
});

describe('P0.2d: /api/bgp auth', () => {
  it('GET /query returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/bgp/query?prefix=1.0.0.0/8`);
    expect(res.status).toBe(401);
  });

  it('GET /query returns 200 with valid key', async () => {
    const res = await api('GET', '/api/bgp/query?prefix=1.0.0.0/8');
    expect(res.status).toBe(200);
  });

  it('GET /stats returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/bgp/stats`);
    expect(res.status).toBe(401);
  });
});

describe('P0.2d: /api/urlhaus auth', () => {
  it('GET /check returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/urlhaus/check?domain=example.com`);
    expect(res.status).toBe(401);
  });

  it('GET /check returns 200/500 with valid key (external API may fail)', async () => {
    const res = await api('GET', '/api/urlhaus/check?domain=example.com');
    // 200 (cached/not found) or 500 (external API failure) — both mean auth passed
    expect([200, 500]).toContain(res.status);
  });
});

describe('P0.2d: /api/otx auth', { timeout: 30_000 }, () => {
  it('GET /check returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/otx/check?indicator=1.2.3.4`);
    expect(res.status).toBe(401);
  });

  it('GET /check returns 200/500 with valid key', { timeout: 25_000 }, async () => {
    const res = await api('GET', '/api/otx/check?indicator=1.2.3.4');
    expect([200, 500]).toContain(res.status);
  });
});

describe('P0.2d: /api/ip auth', () => {
  it('GET /check returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/ip/check?ip=1.2.3.4`);
    expect(res.status).toBe(401);
  });

  it('GET /check returns 200/500 with valid key', async () => {
    const res = await api('GET', '/api/ip/check?ip=1.2.3.4');
    expect([200, 500]).toContain(res.status);
  });
});

describe('P0.2d: /api/report auth', () => {
  it('GET /:sessionId/pdf returns 401 without X-API-Key', async () => {
    const res = await fetch(`${API_BASE}/api/report/nonexistent/pdf`);
    expect(res.status).toBe(401);
  });

  it('GET /:sessionId/pdf returns 404 or 500 with valid key (fake session)', async () => {
    const res = await api('GET', '/api/report/nonexistent-id/pdf');
    // 404 (session not found) or 500 (upstream error) — both mean auth passed
    expect([404, 500]).toContain(res.status);
  });
});
