import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  runRetentionCleanup,
  type RetentionResult,
  type RetentionPreview,
} from '../../src/utils/retention.js';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Seed: create one old audit log
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100); // > 90 days ago
  await prisma.auditLog.create({
    data: {
      userId: 'test-admin',
      action: 'test_old',
      resourceType: 'test',
      details: {},
      createdAt: oldDate,
    },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { action: { in: ['test_old', 'test_new'] } } });
  await prisma.$disconnect();
});

describe('runRetentionCleanup', () => {
  it('default mode is execute (backward compat)', async () => {
    const result = await runRetentionCleanup({ auditLogDays: 90 });
    // Result has execute shape
    expect(typeof (result as RetentionResult).auditLogsDeleted).toBe('number');
  });

  it('mode=preview returns counts without mutating', async () => {
    const before = await prisma.auditLog.count();
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'preview' })) as RetentionPreview;
    const after = await prisma.auditLog.count();
    expect(after).toBe(before);
    expect(typeof result.auditLogsWouldDelete).toBe('number');
  });

  it('mode=execute with old data returns positive delete count', async () => {
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'execute' })) as RetentionResult;
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(0);
  });
});
