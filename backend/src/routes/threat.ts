import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { miniMaxAdapter } from '../services/minimaxAdapter.js';

const investigateSchema = z.object({
  type: z.enum(['ip', 'domain', 'hash']),
  value: z.string().min(1),
  type2: z.enum(['simulation', 'live']).default('live'),
});

export async function threatRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/threat/investigate - Start threat investigation
  fastify.post('/investigate', async (request, reply) => {
    try {
      const body = investigateSchema.parse(request.body);
      const input = {
        indicatorType: body.type,
        value: body.value,
      };

      const session = await miniMaxAdapter.startAnalysis('threat', input);

      // 如果是 simulation 模式，運行模擬
      if (body.type2 === 'simulation') {
        runThreatSimulation(session.id).catch(console.error);
      }

      return reply.status(201).send({
        sessionId: session.id,
        status: session.status,
        currentStep: 0,
        message: 'Investigation session created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      console.error('Threat investigate error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/threat/sessions - Get all sessions
  fastify.get('/sessions', async (request, reply) => {
    try {
      const sessions = await miniMaxAdapter.getAllSessions();
      const threatSessions = sessions.filter((s) => s.module === 'threat');
      return reply.send({ sessions: threatSessions });
    } catch (error) {
      console.error('Get sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/threat/sessions/:id - Get session by ID
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

  // POST /api/threat/sessions/:id/messages - Send message to session
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

// Simulation runner for threat investigation
async function runThreatSimulation(sessionId: string): Promise<void> {
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const session = await miniMaxAdapter.getSession(sessionId);
  if (!session) return;

  const steps = session.steps.sort((a, b) => a.order - b.order);

  for (const step of steps) {
    await delay(500);
    await miniMaxAdapter.updateStepContent(
      step.id,
      `## ${step.title}\n\n已完成威脅情報${step.title.replace('正在', '')}。`
    );
    await delay(2000);
    await miniMaxAdapter.completeStep(step.id);
  }

  await miniMaxAdapter.completeSession(sessionId);
}
