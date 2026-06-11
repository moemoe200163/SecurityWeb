import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { prisma } from '../db/client.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

const importAlertSchema = z.object({
  source: z.string().min(1).max(50).default('import'),
  title: z.string().min(1).max(255),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  raw_content: z.string(),
  normalized_fields: z.any().optional(),
  ai_verdict: z.string().optional(),
});

const importManySchema = z.object({
  alerts: z.array(importAlertSchema),
});

const listAlertsSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  source: z.string().optional(),
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 50),
  offset: z.string().optional().transform(v => v ? parseInt(v, 10) : 0),
});

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // List alerts
  fastify.get(
    '/',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { status, severity, source, limit, offset } = listAlertsSchema.parse(request.query);

        const where: Record<string, string> = {};
        if (status) where.status = status;
        if (severity) where.severity = severity;
        if (source) where.source = source;

        const [alerts, total] = await Promise.all([
          prisma.alert.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.alert.count({ where }),
        ]);

        return reply.send({ alerts, total, limit, offset });
      } catch (error) {
        console.error('List alerts error:', error);
        return reply.status(500).send({ error: 'Failed to list alerts' });
      }
    }
  );

  // Get single alert
  fastify.get(
    '/:id',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const alert = await prisma.alert.findUnique({
          where: { id },
          include: {
            knowledgeFeedback: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!alert) {
          return reply.status(404).send({ error: 'Alert not found' });
        }

        return reply.send({ alert });
      } catch (error) {
        console.error('Get alert error:', error);
        return reply.status(500).send({ error: 'Failed to get alert' });
      }
    }
  );

  // Import single alert
  fastify.post(
    '/import',
    { preHandler: [apiKeyAuth, requireUser, rateLimit(20, 60_000)] },
    async (request, reply) => {
      try {
        const body = importAlertSchema.parse(request.body);

        const alert = await prisma.alert.create({
          data: {
            source: body.source,
            title: body.title,
            severity: body.severity,
            rawContent: body.raw_content,
            normalizedFields: body.normalized_fields as object,
            aiVerdict: body.ai_verdict,
            status: 'new',
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'import',
            resourceType: 'alert',
            resourceId: alert.id,
            details: sanitizeAuditDetails({ source: body.source, severity: body.severity }),
          },
        });

        return reply.status(201).send({ alert });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Import alert error:', error);
        return reply.status(500).send({ error: 'Failed to import alert' });
      }
    }
  );

  // Import many alerts (bulk)
  fastify.post(
    '/import/bulk',
    // P1-7: cap bulk imports at 5/min per key. Single-row import at
    // 20/min is fine, but bulk can write up to 1k rows per call so
    // it's the right knob to tighten.
    { preHandler: [apiKeyAuth, requireUser, rateLimit(5, 60_000)] },
    async (request, reply) => {
      try {
        const { alerts } = importManySchema.parse(request.body);

        if (alerts.length === 0) {
          return reply.status(400).send({ error: 'No alerts to import' });
        }

        if (alerts.length > 1000) {
          return reply.status(400).send({ error: 'Maximum 1000 alerts per import' });
        }

        const created = await prisma.alert.createMany({
          data: alerts.map(a => ({
            source: a.source,
            title: a.title,
            severity: a.severity,
            rawContent: a.raw_content,
            normalizedFields: (a.normalized_fields || {}) as object,
            aiVerdict: a.ai_verdict,
            status: 'new',
          })),
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'import',
            resourceType: 'alert',
            resourceId: 'bulk',
            details: sanitizeAuditDetails({ count: alerts.length }),
          },
        });

        return reply.status(201).send({
          message: `${created.count} alerts imported`,
          count: created.count,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Bulk import error:', error);
        return reply.status(500).send({ error: 'Failed to import alerts' });
      }
    }
  );

  // Update alert status
  fastify.patch(
    '/:id/status',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { status, human_verdict } = z.object({
          status: z.enum(['new', 'investigating', 'resolved', 'ignored', 'false_positive', 'failed_resolution']).optional(),
          human_verdict: z.string().optional(),
        }).parse(request.body);

        const alert = await prisma.alert.update({
          where: { id },
          data: {
            ...(status && { status }),
            ...(human_verdict !== undefined && { humanVerdict: human_verdict }),
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'update',
            resourceType: 'alert',
            resourceId: id,
            details: sanitizeAuditDetails({ status, human_verdict }),
          },
        });

        return reply.send({ alert });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Update alert status error:', error);
        return reply.status(500).send({ error: 'Failed to update alert status' });
      }
    }
  );

  // Submit knowledge feedback
  fastify.post(
    '/:id/feedback',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { session_id, ai_verdict, correct_verdict, error_reason, lesson } = z.object({
          session_id: z.string().optional(),
          ai_verdict: z.string(),
          correct_verdict: z.string(),
          error_reason: z.string().optional(),
          lesson: z.string().optional(),
        }).parse(request.body);

        // Get the alert to compare verdicts
        const alert = await prisma.alert.findUnique({ where: { id } });
        if (!alert) {
          return reply.status(404).send({ error: 'Alert not found' });
        }

        const feedback = await prisma.knowledgeFeedback.create({
          data: {
            alertId: id,
            sessionId: session_id,
            aiVerdict: ai_verdict,
            correctVerdict: correct_verdict,
            errorReason: error_reason,
            lesson,
          },
        });

        // If verdict changed, update alert with human verdict
        if (ai_verdict !== correct_verdict) {
          await prisma.alert.update({
            where: { id },
            data: { humanVerdict: correct_verdict },
          });
        }

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'feedback',
            resourceType: 'alert',
            resourceId: id,
            details: sanitizeAuditDetails({ ai_verdict, correct_verdict, has_error_reason: !!error_reason }),
          },
        });

        return reply.status(201).send({ feedback });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Submit feedback error:', error);
        return reply.status(500).send({ error: 'Failed to submit feedback' });
      }
    }
  );

  // Start deep investigation session
  fastify.post(
    '/:id/investigate',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { type = 'threat' } = z.object({
          type: z.enum(['soc', 'threat', 'pentest']).default('threat'),
        }).parse(request.body);

        // Get the alert (404 must come back from this query, not from a
        // later cascade failure).
        const alert = await prisma.alert.findUnique({ where: { id } });
        if (!alert) {
          return reply.status(404).send({ error: 'Alert not found' });
        }

        // Create a real Session row. The session id (UUID) is what we link
        // to the alert — NOT the alert id. The session's `input` carries
        // enough context to reproduce the investigation later.
        const session = await prisma.session.create({
          data: {
            module: type,
            input: {
              source: 'alert_investigation',
              alertId: alert.id,
              alertTitle: alert.title,
              alertSeverity: alert.severity,
              aiVerdict: alert.aiVerdict,
              rawContent: alert.rawContent,
              normalizedFields: alert.normalizedFields ?? {},
            } as object,
            status: 'in_progress',
          },
        });

        // Link the alert to the new session, and mark it as being investigated.
        await prisma.alert.update({
          where: { id },
          data: { status: 'investigating', sessionId: session.id },
        });

        // Audit log records the linkage so an investigator can follow the
        // session history for an alert.
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'investigate',
            resourceType: 'alert',
            resourceId: id,
            details: sanitizeAuditDetails({ type, sessionId: session.id }),
          },
        });

        return reply.send({
          message: 'Investigation started',
          alert_id: id,
          session_id: session.id,
          type,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Start investigation error:', error);
        return reply.status(500).send({ error: 'Failed to start investigation' });
      }
    }
  );
}