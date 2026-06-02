import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { prisma } from '../db/client.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

const createTemplateSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  tool: z.string().min(1).max(100),
  command_template: z.string().min(1),
  allowed_params: z.record(z.array(z.string())).optional(),
});

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // Get audit log
  fastify.get(
    '/audit-log',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

        const logs = await prisma.auditLog.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({ logs });
      } catch (error) {
        console.error('Get audit log error:', error);
        return reply.status(500).send({ error: 'Failed to get audit log' });
      }
    }
  );

  // Update template (enable/disable/approve)
  fastify.patch(
    '/templates/:id',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const updateSchema = z.object({
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          risk_level: z.enum(['low', 'medium', 'high']).optional(),
          is_enabled: z.boolean().optional(),
          is_approved: z.boolean().optional(),
        });

        const body = updateSchema.parse(request.body);

        const template = await prisma.toolTemplate.update({
          where: { id },
          data: {
            ...(body.name && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.risk_level && { riskLevel: body.risk_level }),
            ...(body.is_enabled !== undefined && { isEnabled: body.is_enabled }),
            ...(body.is_approved !== undefined && { isApproved: body.is_approved }),
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'update',
            resourceType: 'tool_template',
            resourceId: id,
            details: sanitizeAuditDetails(body as Record<string, unknown>),
          },
        });

        return reply.send({ template });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        console.error('Update template error:', error);
        return reply.status(500).send({ error: 'Failed to update template' });
      }
    }
  );

  // Delete template
  fastify.delete(
    '/templates/:id',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        await prisma.toolTemplate.delete({ where: { id } });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'delete',
            resourceType: 'tool_template',
            resourceId: id,
          },
        });

        return reply.send({ message: 'Template deleted' });
      } catch (error) {
        console.error('Delete template error:', error);
        return reply.status(500).send({ error: 'Failed to delete template' });
      }
    }
  );

  // Create/approve tool template
  fastify.post(
    '/templates',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const body = createTemplateSchema.parse(request.body);

        await prisma.toolTemplate.upsert({
          where: { id: body.id },
          update: {
            name: body.name,
            tool: body.tool,
            commandTemplate: body.command_template,
            allowedParams: body.allowed_params || {},
            isApproved: true,
          },
          create: {
            id: body.id,
            name: body.name,
            tool: body.tool,
            commandTemplate: body.command_template,
            allowedParams: body.allowed_params || {},
            createdBy: request.user!.id,
            isApproved: true,
          },
        });

        return reply.status(201).send({
          message: 'Template created successfully',
          template_id: body.id,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Create template error:', error);
        return reply.status(500).send({ error: 'Failed to create template' });
      }
    }
  );

  // Get all users
  fastify.get(
    '/users',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            apiKey: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({ users });
      } catch (error) {
        console.error('Get users error:', error);
        return reply.status(500).send({ error: 'Failed to get users' });
      }
    }
  );

  // Get all templates (admin view with all details)
  fastify.get(
    '/templates',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

        const templates = await prisma.toolTemplate.findMany({
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({ templates });
      } catch (error) {
        console.error('Get templates error:', error);
        return reply.status(500).send({ error: 'Failed to get templates' });
      }
    }
  );

  // Create new API key for user
  fastify.post(
    '/users/:id/api-key',
    { preHandler: [apiKeyAuth, requireAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const newApiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

        await prisma.user.update({
          where: { id },
          data: {
            apiKey: newApiKey,
            updatedAt: new Date(),
          },
        });

        return reply.send({
          message: 'API key regenerated',
          user_id: id,
          api_key: newApiKey,
        });
      } catch (error) {
        console.error('Regenerate API key error:', error);
        return reply.status(500).send({ error: 'Failed to regenerate API key' });
      }
    }
  );
}