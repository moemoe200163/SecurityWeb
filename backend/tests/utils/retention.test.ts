import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  runRetentionCleanup,
  type RetentionResult,
  type RetentionPreview,
} from '../../src/utils/retention.js';

const prisma = new PrismaClient();

/**
 * Seed an audit log row 100 days in the past with a unique marker
 * stored in `details.marker` so this test never collides with other
 * tests or with other retention runs in the same suite.
 *
 * Uses raw SQL to bypass Prisma's @default(now()) on createdAt.
 */
async function seedOldAuditLog(marker: string): Promise<string> {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  const iso = oldDate.toISOString();
  const details: Prisma.InputJsonValue = { marker, test: 'retention-marker' };
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, details, "createdAt")
     VALUES (gen_random_uuid(), 'test-admin', 'test_old', 'test', $1::jsonb, $2::timestamptz)
     RETURNING id`,
    JSON.stringify(details),
    iso,
  );
  return rows[0].id;
}

async function findByMarker(marker: string): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM audit_logs WHERE details->>'marker' = $1 LIMIT 1`,
    marker,
  );
  return rows[0] ?? null;
}

async function deleteByMarker(marker: string): Promise<void> {
  await prisma.$queryRawUnsafe(
    `DELETE FROM audit_logs WHERE details->>'marker' = $1`,
    marker,
  );
}

afterAll(async () => {
  // Best-effort: also clean up any stragglers from interrupted runs
  await prisma.$queryRawUnsafe(
    `DELETE FROM audit_logs WHERE details->>'test' = 'retention-marker'`,
  );
  await prisma.$disconnect();
});

afterEach(async () => {
  // Per-test cleanup marker tracked via closure (see individual tests)
});

describe('runRetentionCleanup', () => {
  it('default mode is execute (backward compat)', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    try {
      const result = await runRetentionCleanup({ auditLogDays: 90 });
      expect(typeof (result as RetentionResult).auditLogsDeleted).toBe('number');
    } finally {
      await deleteByMarker(marker);
    }
    // id is referenced to satisfy linter when seed succeeded
    expect(id).toBeTruthy();
  });

  it('mode=preview returns counts without mutating own row', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    try {
      const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'preview' })) as RetentionPreview;
      expect(result.auditLogsWouldDelete).toBeGreaterThanOrEqual(1);

      // Our specific row must still exist after preview, regardless of
      // what other tests have seeded in the same suite.
      const stillThere = await findByMarker(marker);
      expect(stillThere?.id).toBe(id);
    } finally {
      await deleteByMarker(marker);
    }
  });

  it('mode=execute deletes our seeded row', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    const before = await findByMarker(marker);
    expect(before?.id).toBe(id);

    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'execute' })) as RetentionResult;
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(1);

    const after = await findByMarker(marker);
    expect(after).toBeNull();
  });
});
