import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { WhitelistValidator } from '../services/WhitelistValidator.js';
import { getMCPServer } from '../mcp/server.js';
import { prisma } from '../db/client.js';

const executeToolSchema = z.object({
  template_id: z.string().min(1),
  params: z.record(z.string()),
  session_id: z.string().optional(),
});

const listTemplatesSchema = z.object({
  include_disabled: z.string().optional().transform(v => v === 'true'),
});

export async function toolRoutes(fastify: FastifyInstance): Promise<void> {
  const validator = new WhitelistValidator();

  // Get all templates (for admin/management)
  fastify.get(
    '/templates',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { include_disabled } = listTemplatesSchema.parse(request.query);

        const templates = await prisma.toolTemplate.findMany({
          where: include_disabled ? {} : { isEnabled: true },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            tool: true,
            description: true,
            commandTemplate: true,
            allowedParams: true,
            riskLevel: true,
            isApproved: true,
            isEnabled: true,
            createdAt: true,
            createdBy: true,
          },
        });

        return reply.send({ templates });
      } catch (error) {
        console.error('Get templates error:', error);
        return reply.status(500).send({ error: 'Failed to get templates' });
      }
    }
  );

  // Get single template
  fastify.get(
    '/templates/:id',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const template = await prisma.toolTemplate.findUnique({
          where: { id },
        });

        if (!template) {
          return reply.status(404).send({ error: 'Template not found' });
        }

        return reply.send({ template });
      } catch (error) {
        console.error('Get template error:', error);
        return reply.status(500).send({ error: 'Failed to get template' });
      }
    }
  );

  // Get execution history for current user
  fastify.get(
    '/executions',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { limit = 50, offset = 0, status } = request.query as {
          limit?: number;
          offset?: number;
          status?: string;
        };

        const where = {
          userId: request.user!.id,
          ...(status ? { status } : {}),
        };

        const [executions, total] = await Promise.all([
          prisma.toolExecution.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
              template: {
                select: { id: true, name: true, tool: true, riskLevel: true },
              },
            },
          }),
          prisma.toolExecution.count({ where }),
        ]);

        return reply.send({ executions, total, limit, offset });
      } catch (error) {
        console.error('Get executions error:', error);
        return reply.status(500).send({ error: 'Failed to get executions' });
      }
    }
  );

  // Get single execution
  fastify.get(
    '/executions/:id',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        const execution = await prisma.toolExecution.findUnique({
          where: { id },
          include: {
            template: true,
            user: {
              select: { id: true, role: true },
            },
          },
        });

        if (!execution) {
          return reply.status(404).send({ error: 'Execution not found' });
        }

        // Only allow owner or admin to view
        if (execution.userId !== request.user!.id && request.user!.role !== 'admin') {
          return reply.status(403).send({ error: 'Access denied' });
        }

        return reply.send({ execution });
      } catch (error) {
        console.error('Get execution error:', error);
        return reply.status(500).send({ error: 'Failed to get execution' });
      }
    }
  );

  // Execute tool via template
  fastify.post(
    '/execute',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const body = executeToolSchema.parse(request.body);
        const { template_id, params, session_id } = body;

        // Validate and build command from whitelist
        const validation = await validator.validateAndBuildCommand(template_id, params);

        if (!validation.valid || !validation.command) {
          // Record failed execution attempt
          await prisma.toolExecution.create({
            data: {
              templateId: template_id,
              userId: request.user!.id,
              sessionId: session_id,
              params,
              status: 'error',
              error: validation.error || 'Validation failed',
              durationMs: Date.now() - startTime,
            },
          });

          return reply.status(400).send({
            error: validation.error || 'Invalid command',
          });
        }

        // Record pending execution
        const execution = await prisma.toolExecution.create({
          data: {
            templateId: template_id,
            userId: request.user!.id,
            sessionId: session_id,
            params,
            status: 'running',
          },
        });

        // Execute via MCP server
        const mcpServer = await getMCPServer();
        const toolName = getToolNameFromTemplate(template_id);
        const result = await mcpServer.executeTool({
          name: toolName,
          arguments: params,
        });

        const durationMs = Date.now() - startTime;
        const finalStatus = result.success ? 'success' : 'error';

        // Update execution record
        await prisma.toolExecution.update({
          where: { id: execution.id },
          data: {
            status: finalStatus,
            output: result.output || '',
            error: result.error,
            durationMs,
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: request.user!.id,
            action: 'execute',
            resourceType: 'tool_template',
            resourceId: template_id,
            details: {
              executionId: execution.id,
              success: result.success,
              durationMs,
            },
          },
        });

        return reply.send({
          execution_id: execution.id,
          success: result.success,
          output: result.output,
          error: result.error,
          duration_ms: durationMs,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Tool execution error:', error);

        // Record failed execution
        await prisma.toolExecution.create({
          data: {
            templateId: 'unknown',
            userId: request.user!.id,
            params: {},
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: Date.now() - startTime,
          },
        });

        return reply.status(500).send({ error: 'Tool execution failed' });
      }
    }
  );
}

function getToolNameFromTemplate(templateId: string): string {
  const mapping: Record<string, string> = {
    nmap_basic: 'nmap_scan',
    nmap_stealth: 'nmap_scan',
    nmap_full: 'nmap_scan',
    sql_basic: 'sqlmap_scan',
    sql_dump: 'sqlmap_scan',
    nikto_web: 'nikto_scan',
    nikto_ssl: 'nikto_scan',
    hydra_ssh: 'hydra_brute',
    hydra_http: 'hydra_brute',
  };
  return mapping[templateId] || 'nmap_scan';
}