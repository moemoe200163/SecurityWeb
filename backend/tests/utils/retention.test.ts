import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  runRetentionCleanup,
  type RetentionResult,
  type RetentionPreview,
} from '../../src/utils/retention.js';

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { action: 'test_old' } });
  await prisma.$disconnect();
});

/**
 * Insert an audit log row 100 days in the past using raw SQL,
 * bypassing Prisma's @default(now()) on createdAt.
 * Returns the row id.
 */
async function seedOldAuditLog(): Promise<string> {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  const iso = oldDate.toISOString();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, details, "createdAt")
     VALUES (gen_random_uuid(), 'test-admin', 'test_old', 'test', '{}'::jsonb, $1::timestamptz)
     RETURNING id`,
    iso,
  );
  return rows[0].id;
}

describe('runRetentionCleanup', () => {
  it('default mode is execute (backward compat)', async () => {
    const id = await seedOldAuditLog();
    const result = await runRetentionCleanup({ auditLogDays: 90 });
    expect(typeof (result as RetentionResult).auditLogsDeleted).toBe('number');
    await prisma.auditLog.delete({ where: { id } }).catch(() => {});
  });

  it('mode=preview returns counts without mutating', async () => {
    const id = await seedOldAuditLog();
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'preview' })) as RetentionPreview;
    expect(result.auditLogsWouldDelete).toBeGreaterThanOrEqual(1);
    // Verify the seeded row was NOT deleted by preview
    const stillThere = await prisma.auditLog.findUnique({ where: { id } });
    expect(stillThere).not.toBeNull();
    await prisma.auditLog.delete({ where: { id } }).catch(() => {});
  });

  it('mode=execute with old data returns positive delete count', async () => {
    const id = await seedOldAuditLog();
    const before = await prisma.auditLog.findUnique({ where: { id } });
    expect(before).not.toBeNull();
    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'execute' })) as RetentionResult;
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(1);
    const after = await prisma.auditLog.findUnique({ where: { id } });
    expect(after).toBeNull();
  });
});
