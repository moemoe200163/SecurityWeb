import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { prisma } from '../db/client.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

const createEvidenceSchema = z.object({
  type: z.enum(['tool', 'intelligence', 'manual', 'ai']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  data: z.unknown().optional(),
  alertId: z.string().uuid().optional(),
  toolExecutionId: z.string().uuid().optional(),
});

export async function evidenceRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/sessions/:sessionId/evidence — Add evidence to a session
  fastify.post(
    '/:sessionId/evidence',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const body = createEvidenceSchema.parse(request.body);

        // Verify session exists
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { id: true },
        });
        if (!session) {
          return reply.status(404).send({ error: 'Session not found' });
        }

        const evidence = await prisma.evidence.create({
          data: {
            sessionId,
            alertId: body.alertId ?? null,
            toolExecutionId: body.toolExecutionId ?? null,
            type: body.type,
            title: body.title,
            content: body.content,
            data: body.data ?? undefined,
            createdById: request.user!.id,
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'create',
            resourceType: 'evidence',
            resourceId: evidence.id,
            details: sanitizeAuditDetails({
              sessionId,
              type: body.type,
              title: body.title,
              alertId: body.alertId,
              toolExecutionId: body.toolExecutionId,
            }),
          },
        });

        return reply.status(201).send({ evidence });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Create evidence error:', error);
        return reply.status(500).send({ error: 'Failed to create evidence' });
      }
    }
  );

  // GET /api/sessions/:sessionId/evidence — List evidence for a session
  fastify.get(
    '/:sessionId/evidence',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };

        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { id: true },
        });
        if (!session) {
          return reply.status(404).send({ error: 'Session not found' });
        }

        const evidence = await prisma.evidence.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
        });

        return reply.send({ evidence });
      } catch (error) {
        console.error('List evidence error:', error);
        return reply.status(500).send({ error: 'Failed to list evidence' });
      }
    }
  );

  // DELETE /api/sessions/:sessionId/evidence/:evidenceId — Remove evidence
  fastify.delete(
    '/:sessionId/evidence/:evidenceId',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { sessionId, evidenceId } = request.params as {
          sessionId: string;
          evidenceId: string;
        };

        const evidence = await prisma.evidence.findFirst({
          where: { id: evidenceId, sessionId },
        });
        if (!evidence) {
          return reply.status(404).send({ error: 'Evidence not found' });
        }

        await prisma.evidence.delete({ where: { id: evidenceId } });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'delete',
            resourceType: 'evidence',
            resourceId: evidenceId,
            details: sanitizeAuditDetails({
              sessionId,
              type: evidence.type,
              title: evidence.title,
            }),
          },
        });

        return reply.send({ success: true });
      } catch (error) {
        console.error('Delete evidence error:', error);
        return reply.status(500).send({ error: 'Failed to delete evidence' });
      }
    }
  );
}
