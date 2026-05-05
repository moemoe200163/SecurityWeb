import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { miniMaxAdapter } from '../services/minimaxAdapter.js';

const analyzeSchema = z.object({
  alertId: z.string().optional(),
  rawContent: z.string().optional(),
  type: z.enum(['simulation', 'live']).default('live'),
});

export async function socRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/soc/analyze - Start SOC analysis
  fastify.post('/analyze', async (request, reply) => {
    try {
      const body = analyzeSchema.parse(request.body);
      const input = {
        alertId: body.alertId || `SOC-${Date.now()}`,
        rawContent: body.rawContent,
      };

      const session = await miniMaxAdapter.startAnalysis('soc', input);

      // 如果是 simulation 模式，運行模擬
      if (body.type === 'simulation') {
        runSimulation(session.id).catch(console.error);
      }

      return reply.status(201).send({
        sessionId: session.id,
        status: session.status,
        currentStep: 0,
        message: 'Analysis session created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      console.error('SOC analyze error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/soc/sessions - Get all sessions
  fastify.get('/sessions', async (request, reply) => {
    try {
      const sessions = await miniMaxAdapter.getAllSessions();
      return reply.send({ sessions });
    } catch (error) {
      console.error('Get sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/soc/sessions/:id - Get session by ID
  fastify.get('/sessions/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = await miniMaxAdapter.getSession(id);

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return reply.send({ session });
    } catch (error) {
      console.error('Get session error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/soc/sessions/:id/messages - Send message to session
  fastify.post('/sessions/:id/messages', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };

      if (!content || typeof content !== 'string') {
        return reply.status(400).send({ error: 'Content is required' });
      }

      const message = await miniMaxAdapter.sendMessage(id, content);
      return reply.status(201).send({ message });
    } catch (error) {
      console.error('Send message error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// Simulation runner for SOC analysis
async function runSimulation(sessionId: string): Promise<void> {
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const session = await miniMaxAdapter.getSession(sessionId);
  if (!session) return;

  const steps = session.steps.sort((a, b) => a.order - b.order);

  for (const step of steps) {
    await delay(500);
    await miniMaxAdapter.updateStepContent(
      step.id,
      `## ${step.title}\n\n已完成 ${step.title} 分析。`
    );
    await delay(2000);
    await miniMaxAdapter.completeStep(step.id);
  }

  await miniMaxAdapter.completeSession(sessionId);
}
