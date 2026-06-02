import { prisma } from '../db/client.js';

export interface RetentionResult {
  auditLogsDeleted: number;
  toolExecutionsTrimmed: number;
  bgpUpdatesDeleted: number;
}

/**
 * Clean up old audit logs older than the specified days.
 * Default: 90 days.
 */
export async function cleanupAuditLogs(retentionDays = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

/**
 * Trim output field from old tool executions to save space.
 * Keeps metadata but truncates output for records older than retentionDays.
 * Default: 30 days.
 */
export async function trimToolExecutionOutput(retentionDays = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.toolExecution.updateMany({
    where: {
      createdAt: { lt: cutoff },
      output: { not: null },
    },
    data: { output: '(trimmed by retention policy)' },
  });
  return result.count;
}

/**
 * Delete old BGP updates older than the specified days.
 * Default: 7 days (BGP data is time-sensitive, older data has low value).
 */
export async function cleanupBgpUpdates(retentionDays = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.bgpUpdate.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });
  return result.count;
}

/**
 * Run all retention cleanup tasks.
 */
export async function runRetentionCleanup(config?: {
  auditLogDays?: number;
  toolExecutionDays?: number;
  bgpUpdateDays?: number;
}): Promise<RetentionResult> {
  const [auditLogsDeleted, toolExecutionsTrimmed, bgpUpdatesDeleted] = await Promise.all([
    cleanupAuditLogs(config?.auditLogDays),
    trimToolExecutionOutput(config?.toolExecutionDays),
    cleanupBgpUpdates(config?.bgpUpdateDays),
  ]);

  return { auditLogsDeleted, toolExecutionsTrimmed, bgpUpdatesDeleted };
}
