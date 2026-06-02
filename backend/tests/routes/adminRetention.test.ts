import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_API_KEY } from '../setup.js';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:4000';
const prisma = new PrismaClient();

async function api(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'X-API-Key': TEST_API_KEY,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

let oldAuditLogId: string;

beforeAll(async () => {
  // Sanity: the API must be reachable before running real assertions.
  const health = await fetch(`${API_BASE}/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `Backend not reachable at ${API_BASE}. Start it (e.g. docker compose --profile dev up -d backend) before running tests.`,
    );
  }

  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  const created = await prisma.auditLog.create({
    data: {
      userId: 'test-admin',
      action: 'phase19.2_test_old',
      resourceType: 'test',
      details: {},
      createdAt: oldDate,
    },
  });
  oldAuditLogId = created.id;
});

afterAll(async () => {
  // Audit log cleanup: own seeded row + the rows this test suite created.
  // (Resource FKs back to users — no users were created here, so user
  // deleteMany isn't needed.)
  await prisma.auditLog.deleteMany({ where: { action: 'phase19.2_test_old' } });
  await prisma.auditLog.deleteMany({ where: { action: 'retention_run' } });
  await prisma.auditLog.deleteMany({ where: { action: 'retention_run_partial' } });
  await prisma.$disconnect();
});

describe('W19.2: /api/admin/retention', () => {
  it('GET /status returns counts and policy', async () => {
    const res = await api('GET', '/api/admin/retention/status');
    expect(res.status).toBe(200);
    expect(res.data.counts).toBeDefined();
    expect(res.data.policy.auditLogDays).toBe(90);
    expect(res.data.policy.toolExecutionDays).toBe(30);
    expect(res.data.policy.bgpUpdateDays).toBe(7);
  });

  it('POST /run?dryRun=true returns preview, no mutation', async () => {
    const before = await prisma.auditLog.count();
    const res = await api('POST', '/api/admin/retention/run?dryRun=true', { auditLogDays: 90 });
    expect(res.status).toBe(200);
    expect(res.data.mode).toBe('dry-run');
    expect(res.data.preview.auditLogsWouldDelete).toBeGreaterThanOrEqual(1);
    const after = await prisma.auditLog.count();
    // Dry run still writes its own retention_run audit row, so count goes up by 1
    // — but the key invariant is that the seeded old row is still present.
    const stillThere = await prisma.auditLog.findUnique({ where: { id: oldAuditLogId } });
    expect(stillThere).not.toBeNull();
    expect(after).toBe(before + 1);
  });

  it('POST /run executes and writes audit log with action=retention_run', async () => {
    const res = await api('POST', '/api/admin/retention/run', { auditLogDays: 90 });
    expect(res.status).toBe(200);
    expect(res.data.mode).toBe('execute');
    expect(res.data.result.auditLogsDeleted).toBeGreaterThanOrEqual(1);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'retention_run' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
  });

  it('GET /status after run shows updated lastRunAt and lastResult', async () => {
    const res = await api('GET', '/api/admin/retention/status');
    expect(res.status).toBe(200);
    expect(res.data.lastRunAt).not.toBeNull();
    expect(res.data.lastResult).not.toBeNull();
  });

  it('POST /run with invalid body returns 400', async () => {
    const res = await api('POST', '/api/admin/retention/run', { auditLogDays: -1 });
    expect(res.status).toBe(400);
  });
});
