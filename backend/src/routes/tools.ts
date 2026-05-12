import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { WhitelistValidator } from '../services/WhitelistValidator.js';
import { getMCPServer } from '../mcp/server.js';

const executeToolSchema = z.object({
  template_id: z.string().min(1),
  params: z.record(z.string()),
});

export async function toolRoutes(fastify: FastifyInstance): Promise<void> {
  const validator = new WhitelistValidator();

  // Get available templates
  fastify.get(
    '/templates',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const templates = await validator.getAllApprovedTemplates();
        return reply.send({ templates });
      } catch (error) {
        console.error('Get templates error:', error);
        return reply.status(500).send({ error: 'Failed to get templates' });
      }
    }
  );

  // Execute tool via template
  fastify.post(
    '/execute',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const body = executeToolSchema.parse(request.body);
        const { template_id, params } = body;

        // Validate and build command from whitelist
        const validation = await validator.validateAndBuildCommand(template_id, params);

        if (!validation.valid || !validation.command) {
          return reply.status(400).send({
            error: validation.error || 'Invalid command',
          });
        }

        // Execute via MCP server
        const mcpServer = await getMCPServer();
        const executionId = crypto.randomUUID();

        // Map template_id to MCP tool name
        const toolName = getToolNameFromTemplate(template_id);
        const result = await mcpServer.executeTool({
          name: toolName,
          arguments: params,
        });

        return reply.send({
          execution_id: executionId,
          success: result.success,
          output: result.output,
          error: result.error,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        console.error('Tool execution error:', error);
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