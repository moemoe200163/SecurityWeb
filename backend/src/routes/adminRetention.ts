import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { prisma } from '../db/client.js';
import {
  runRetentionCleanup,
  runRetentionCleanupWithErrorReporting,
} from '../utils/retention.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

const POLICY_DEFAULTS = { auditLogDays: 90, toolExecutionDays: 30, bgpUpdateDays: 7 };

const runBodySchema = z.object({
  auditLogDays: z.number().int().positive().optional(),
  toolExecutionDays: z.number().int().positive().optional(),
  bgpUpdateDays: z.number().int().positive().optional(),
});

export async function adminRetentionRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/admin/retention/status
  fastify.get(
    '/retention/status',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (_request, reply) => {
      try {
        const [auditLog, toolExecution, bgpUpdate, lastEntry] = await Promise.all([
          prisma.auditLog.count(),
          prisma.toolExecution.count(),
          prisma.bgpUpdate.count(),
          prisma.auditLog.findFirst({
            where: { action: { in: ['retention_run', 'cleanup'] } },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        let lastResult: { auditLogsDeleted: number; toolExecutionsTrimmed: number; bgpUpdatesDeleted: number } | null = null;
        if (lastEntry?.details) {
          const d = lastEntry.details as Record<string, unknown>;
          // Legacy (action='cleanup'):    details = { auditLogsDeleted, ... }
          // New     (action='retention_run'): details = { mode, result: { auditLogsDeleted, ... }, config }
          const source = (d.result as Record<string, unknown> | undefined) ?? d;
          if (typeof source.auditLogsDeleted === 'number') {
            lastResult = {
              auditLogsDeleted: source.auditLogsDeleted as number,
              toolExecutionsTrimmed: (source.toolExecutionsTrimmed as number) ?? 0,
              bgpUpdatesDeleted: (source.bgpUpdatesDeleted as number) ?? 0,
            };
          }
        }

        return reply.send({
          counts: { auditLog, toolExecution, bgpUpdate },
          lastRunAt: lastEntry?.createdAt.toISOString() ?? null,
          lastResult,
          policy: POLICY_DEFAULTS,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'retention status failed');
        return reply.status(500).send({ error: 'Failed to fetch retention status' });
      }
    }
  );

  // POST /api/admin/retention/run
  fastify.post(
    '/retention/run',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const dryRun = (request.query as { dryRun?: string }).dryRun === 'true';
        const body = runBodySchema.parse(request.body ?? {});
        const ranAt = new Date().toISOString();

        if (dryRun) {
          const preview = (await runRetentionCleanup({
            auditLogDays: body.auditLogDays,
            toolExecutionDays: body.toolExecutionDays,
            bgpUpdateDays: body.bgpUpdateDays,
            mode: 'preview',
          })) as { auditLogsWouldDelete: number; toolExecutionsWouldTrim: number; bgpUpdatesWouldDelete: number };

          await prisma.auditLog.create({
            data: {
              userId: request.user!.id,
              action: 'retention_run',
              resourceType: 'retention',
              details: sanitizeAuditDetails({ mode: 'dry-run', preview, config: body }),
            },
          });
          return reply.send({ mode: 'dry-run', preview, ranAt });
        }

        // Real run with per-table error reporting
        const result = await runRetentionCleanupWithErrorReporting({
          auditLogDays: body.auditLogDays,
          toolExecutionDays: body.toolExecutionDays,
          bgpUpdateDays: body.bgpUpdateDays,
        });

        if ('errors' in result) {
          await prisma.auditLog.create({
            data: {
              userId: request.user!.id,
              action: 'retention_run_partial',
              resourceType: 'retention',
              details: sanitizeAuditDetails({ mode: 'execute', errors: result.errors, partial: result.partial }),
            },
          });
          return reply.status(500).send({
            error: 'Retention partially failed',
            errors: result.errors,
            partial: result.partial,
          });
        }

        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'retention_run',
            resourceType: 'retention',
            details: sanitizeAuditDetails({ mode: 'execute', result, config: body }),
          },
        });

        return reply.send({ mode: 'execute', result, ranAt });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid retention parameters', details: error.errors });
        }
        fastify.log.error({ err: error }, 'retention run failed');
        return reply.status(500).send({ error: 'Failed to run retention' });
      }
    }
  );
}
