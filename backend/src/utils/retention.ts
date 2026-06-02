import { prisma } from '../db/client.js';

export type RetentionMode = 'execute' | 'preview';

export interface RetentionConfig {
  auditLogDays?: number;
  toolExecutionDays?: number;
  bgpUpdateDays?: number;
  mode?: RetentionMode;
}

export interface RetentionResult {
  auditLogsDeleted: number;
  toolExecutionsTrimmed: number;
  bgpUpdatesDeleted: number;
}

export interface RetentionPreview {
  auditLogsWouldDelete: number;
  toolExecutionsWouldTrim: number;
  bgpUpdatesWouldDelete: number;
}

async function cleanupAuditLogs(days = 90, mode: RetentionMode = 'execute'): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  if (mode === 'preview') {
    return prisma.auditLog.count({ where: { createdAt: { lt: cutoff } } });
  }
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

async function trimToolExecutionOutput(days = 30, mode: RetentionMode = 'execute'): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  if (mode === 'preview') {
    return prisma.toolExecution.count({
      where: { createdAt: { lt: cutoff }, output: { not: null } },
    });
  }
  const result = await prisma.toolExecution.updateMany({
    where: { createdAt: { lt: cutoff }, output: { not: null } },
    data: { output: '(trimmed by retention policy)' },
  });
  return result.count;
}

async function cleanupBgpUpdates(days = 7, mode: RetentionMode = 'execute'): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  if (mode === 'preview') {
    return prisma.bgpUpdate.count({ where: { timestamp: { lt: cutoff } } });
  }
  const result = await prisma.bgpUpdate.deleteMany({ where: { timestamp: { lt: cutoff } } });
  return result.count;
}

export async function runRetentionCleanup(
  config?: RetentionConfig
): Promise<RetentionResult | RetentionPreview> {
  const mode = config?.mode ?? 'execute';
  const [auditLogs, toolExecs, bgpUpdates] = await Promise.all([
    cleanupAuditLogs(config?.auditLogDays, mode),
    trimToolExecutionOutput(config?.toolExecutionDays, mode),
    cleanupBgpUpdates(config?.bgpUpdateDays, mode),
  ]);
  if (mode === 'preview') {
    return {
      auditLogsWouldDelete: auditLogs,
      toolExecutionsWouldTrim: toolExecs,
      bgpUpdatesWouldDelete: bgpUpdates,
    };
  }
  return {
    auditLogsDeleted: auditLogs,
    toolExecutionsTrimmed: toolExecs,
    bgpUpdatesDeleted: bgpUpdates,
  };
}

/**
 * Run retention with per-table error reporting.
 * If any table throws, returns 500 with partial counts and per-table errors.
 */
export interface RetentionPartialFailure {
  errors: Array<{ table: 'auditLog' | 'toolExecution' | 'bgpUpdate'; message: string }>;
  partial: { auditLogsDeleted: number; toolExecutionsTrimmed: number; bgpUpdatesDeleted: number };
}

export async function runRetentionCleanupWithErrorReporting(
  config?: Omit<RetentionConfig, 'mode'>
): Promise<RetentionResult | RetentionPartialFailure> {
  const auditPromise = cleanupAuditLogs(config?.auditLogDays).then(
    (n) => ({ table: 'auditLog' as const, value: n }),
    (e: Error) => ({ table: 'auditLog' as const, error: e.message })
  );
  const toolPromise = trimToolExecutionOutput(config?.toolExecutionDays).then(
    (n) => ({ table: 'toolExecution' as const, value: n }),
    (e: Error) => ({ table: 'toolExecution' as const, error: e.message })
  );
  const bgpPromise = cleanupBgpUpdates(config?.bgpUpdateDays).then(
    (n) => ({ table: 'bgpUpdate' as const, value: n }),
    (e: Error) => ({ table: 'bgpUpdate' as const, error: e.message })
  );
  const settled = await Promise.all([auditPromise, toolPromise, bgpPromise]);
  const errors: RetentionPartialFailure['errors'] = [];
  let auditLogsDeleted = 0;
  let toolExecutionsTrimmed = 0;
  let bgpUpdatesDeleted = 0;
  for (const r of settled) {
    if ('error' in r) {
      errors.push({ table: r.table, message: r.error });
    } else if (r.table === 'auditLog') auditLogsDeleted = r.value;
    else if (r.table === 'toolExecution') toolExecutionsTrimmed = r.value;
    else if (r.table === 'bgpUpdate') bgpUpdatesDeleted = r.value;
  }
  if (errors.length > 0) {
    return {
      errors,
      partial: { auditLogsDeleted, toolExecutionsTrimmed, bgpUpdatesDeleted },
    };
  }
  return { auditLogsDeleted, toolExecutionsTrimmed, bgpUpdatesDeleted };
}
