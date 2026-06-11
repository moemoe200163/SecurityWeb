import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAIService } from '../services/AIServiceFactory.js';
import type { AIService } from '../services/types.js';
import { prisma } from '../db/client.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { checkSessionAccess } from '../utils/sessionAccess.js';

const investigateSchema = z.object({
  type: z.enum(['ip', 'domain', 'hash']),
  value: z.string().min(1),
});

// Live mode initial prompt for threat investigation
async function buildThreatInvestigationPrompt(type: string, value: string): Promise<string> {
  // 如果是 IP 類型，先查詢本地資料庫
  let localDbInfo = '';
  if (type === 'ip') {
    try {
      const dbRecord = await prisma.ipReputation.findUnique({
        where: { ipAddress: value }
      });
      if (dbRecord) {
        const sourcesList = Array.isArray(dbRecord.sources)
          ? (dbRecord.sources as any[]).map((s: any) => s.name).join(', ')
          : '無';
        localDbInfo = `
【本地資料庫查詢結果】：
- IP: ${dbRecord.ipAddress}
- 狀態: ${dbRecord.status}
- 威脅等級: ${dbRecord.threatLevel}
- 信心分數: ${dbRecord.confidenceScore}%
- 國家: ${dbRecord.countryName || '未知'}
- ISP: ${dbRecord.isp || '未知'}
- 舉報次數: ${dbRecord.totalReports || 0}
- 是否在白名單: ${dbRecord.isWhitelisted ? '是' : '否'}
- 資料來源: ${sourcesList}
`;
      } else {
        localDbInfo = `\n【本地資料庫】：尚無此 IP (${value}) 的記錄\n`;
      }
    } catch (err) {
      localDbInfo = `\n【本地資料庫】：查詢失敗\n`;
    }
  }

  return `你現在是資安威脅情報分析專家。請用**5步結構化格式**分析，每步必須獨立一段開頭：

## 第1步：收集資料
【威脅判定】：
【風險等級】：
【主要結論】：

## 第2步：擴展線索
【關鍵發現】：
【相關指標】：

## 第3步：關聯分析
【關聯服務】：
【攻擊者背景】：

## 第4步：攻擊路徑
【可能的攻擊方式】：
【Kill Chain 分析】：

## 第5步：威脅報告
【建議】：
【監控建議】：

${localDbInfo}
請直接開始分析，不要廢話：${value}`;
}

export async function threatRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/threat/investigate - Start threat investigation
  fastify.post('/investigate', { preHandler: [apiKeyAuth, requireUser, rateLimit(10, 60_000)] }, async (request, reply) => {
    try {
      const ai = await getAIService();
      const body = investigateSchema.parse(request.body);
      const input = {
        indicator: body.value,
        indicatorType: body.type,
      };

      const session = await ai.startAnalysis('threat', input, request.user!.id);

      // Trigger real MiniMax analysis
      triggerThreatAnalysis(session.id, body.type, body.value, ai).catch(console.error);

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
  fastify.get('/sessions', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const ai = await getAIService();
      const sessions = await ai.getAllSessions();
      let threatSessions = sessions.filter((s) => s.module === 'threat');
      // Non-admin users only see their own sessions; legacy null-owned sessions
      // are admin-only.
      if (request.user!.role !== 'admin') {
        const myId = request.user!.id;
        threatSessions = threatSessions.filter((s) => s.userId === myId);
      }
      return reply.send({ sessions: threatSessions });
    } catch (error) {
      console.error('Get sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/threat/sessions/:id - Get session by ID
  fastify.get('/sessions/:id', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const access = await checkSessionAccess(request, id);
      if (access === 'not_found') {
        return reply.status(404).send({ error: 'Session not found' });
      }
      if (access === 'forbidden') {
        return reply.status(403).send({ error: 'You do not have access to this session' });
      }

      const ai = await getAIService();
      const session = await ai.getSession(id);
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
  fastify.post('/sessions/:id/messages', { preHandler: [apiKeyAuth, requireUser, rateLimit(30, 60_000)] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const access = await checkSessionAccess(request, id);
      if (access === 'not_found') {
        return reply.status(404).send({ error: 'Session not found' });
      }
      if (access === 'forbidden') {
        return reply.status(403).send({ error: 'You do not have access to this session' });
      }

      const ai = await getAIService();
      const { content } = request.body as { content: string };

      if (!content || typeof content !== 'string') {
        return reply.status(400).send({ error: 'Content is required' });
      }
      // P1-4 fix: cap content size at 10k chars (same as SOC route)
      if (content.length > 10000) {
        return reply.status(400).send({ error: 'Content must not exceed 10000 characters' });
      }

      const message = await ai.sendMessage(id, content);
      return reply.status(201).send({ message });
    } catch (error) {
      console.error('Send message error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// Real threat analysis runner - triggers MiniMax AI analysis
async function triggerThreatAnalysis(sessionId: string, type: string, value: string, ai: AIService): Promise<void> {
  try {
    const session = await ai.getSession(sessionId);
    if (!session) return;

    const steps = session.steps.sort((a, b) => a.order - b.order);

    // Update first step to running
    if (steps.length > 0) {
      await ai.updateStepContent(
        steps[0].id,
        `正在收集 ${type.toUpperCase()} "${value}" 的威脅情報...`
      );
    }

    // Build and send the investigation prompt to MiniMax
    const prompt = await buildThreatInvestigationPrompt(type, value);
    await ai.sendMessage(sessionId, prompt);

    // AI analysis is complete (sendMessage handles step completion internally)
    console.log(`Threat analysis completed for ${type}:${value}`);
  } catch (error) {
    console.error('Threat analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'API 呼叫失敗，請聯絡管理員';

    // Mark all steps as error with the failure message
    const session = await ai.getSession(sessionId);
    if (session) {
      for (const step of session.steps) {
        try {
          await ai.updateStepContent(step.id, `分析失敗: ${errorMessage}`);
          await ai.completeStep(step.id);
        } catch {}
      }
      // Mark session as error
      await ai.completeSession(sessionId);
    }
  }
}
