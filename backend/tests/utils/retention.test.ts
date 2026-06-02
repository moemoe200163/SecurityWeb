import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  runRetentionCleanup,
  type RetentionResult,
  type RetentionPreview,
} from '../../src/utils/retention.js';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { action: { in: ['test_old', 'test_new'] } } });
  await prisma.$disconnect();
});

async function seedOldAuditLog(): Promise<string> {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  const row = await prisma.auditLog.create({
    data: {
      userId: 'test-admin',
      action: 'test_old',
      resourceType: 'test',
      details: {},
      createdAt: oldDate,
    },
  });
  return row.id;
}

describe('runRetentionCleanup', () => {
  it('default mode is execute (backward compat)', async () => {
    await seedOldAuditLog();
    const result = await runRetentionCleanup({ auditLogDays: 90 });
    expect(typeof (result as RetentionResult).auditLogsDeleted).toBe('number');
  });

  it('mode=preview returns counts without mutating', async () => {
    const id = await seedOldAuditLog();
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'preview' })) as RetentionPreview;
    expect(result.auditLogsWouldDelete).toBeGreaterThanOrEqual(1);
    // Verify the seeded row was NOT deleted by preview
    const stillThere = await prisma.auditLog.findUnique({ where: { id } });
    expect(stillThere).not.toBeNull();
    // Clean up
    await prisma.auditLog.delete({ where: { id } });
  });

  it('mode=execute with old data returns positive delete count', async () => {
    await seedOldAuditLog();
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'execute' })) as RetentionResult;
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(1);
  });
});
