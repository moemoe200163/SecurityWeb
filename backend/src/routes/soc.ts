import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { getAIService } from '../services/AIServiceFactory.js';
import type { AIService } from '../services/types.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { checkSessionAccess } from '../utils/sessionAccess.js';
import PDFDocument from 'pdfkit';

const analyzeSchema = z.object({
  alertId: z.string().optional(),
  rawContent: z.string().optional(),
  type: z.enum(['simulation', 'live']).default('live'),
});

export async function socRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/soc/analyze - Start SOC analysis
  fastify.post('/analyze', { preHandler: [apiKeyAuth, requireUser, rateLimit(10, 60_000)] }, async (request, reply) => {
    try {
      const ai = await getAIService();
      const body = analyzeSchema.parse(request.body);
      const input = {
        alertId: body.alertId || `SOC-${Date.now()}`,
        rawContent: body.rawContent,
      };

      const session = await ai.startAnalysis('soc', input, request.user!.id);

      // 如果是 simulation 模式，運行模擬
      if (body.type === 'simulation') {
        runSimulation(session.id, ai).catch(console.error);
      } else {
        // Live mode - trigger real MiniMax analysis
        triggerSOCAnalysis(session.id, input.rawContent || input.alertId || '', ai).catch(console.error);
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
  fastify.get('/sessions', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const ai = await getAIService();
      const sessions = await ai.getAllSessions();
      // Non-admin users only see their own sessions; null-owned (legacy) sessions
      // are admin-only and stay hidden from regular users.
      if (request.user!.role !== 'admin') {
        const myId = request.user!.id;
        return reply.send({
          sessions: sessions.filter((s) => s.userId === myId),
        });
      }
      return reply.send({ sessions });
    } catch (error) {
      console.error('Get sessions error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/soc/sessions/:id - Get session by ID
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

  // POST /api/soc/sessions/:id/messages - Send message to session
  fastify.post('/sessions/:id/messages', { preHandler: [apiKeyAuth, requireUser, rateLimit(30, 60_000)] }, async (request, reply) => {
    try {
      const ai = await getAIService();
      const { id } = request.params as { id: string };

      const access = await checkSessionAccess(request, id);
      if (access === 'not_found') {
        return reply.status(404).send({ error: 'Session not found' });
      }
      if (access === 'forbidden') {
        return reply.status(403).send({ error: 'You do not have access to this session' });
      }

      const { content } = request.body as { content: string };

      if (!content || typeof content !== 'string') {
        return reply.status(400).send({ error: 'Content is required' });
      }

      if (content.length > 10000) {
        return reply.status(400).send({ error: 'Content must not exceed 10000 characters' });
      }

      const session = await ai.getSession(id);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const message = await ai.sendMessage(id, content);
      return reply.status(201).send({ message });
    } catch (error) {
      console.error('Send message error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/soc/sessions/:id/report - Generate PDF report for SOC session
  fastify.get<{ Params: { id: string } }>('/sessions/:id/report', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const { id } = request.params;
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

      // Get AI response content for the report
      const aiMessages = session.messages.filter(m => m.role === 'assistant');
      const latestReport = aiMessages.length > 0 ? aiMessages[aiMessages.length - 1].content : '';

      // Generate PDF
      const pdfBuffer = await generateSOCReportPDF(session, latestReport);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="SOC-Report-${id}.pdf"`);
      return reply.send(pdfBuffer);
    } catch (error) {
      console.error('SOC report error:', error);
      return reply.status(500).send({ error: 'Failed to generate report' });
    }
  });
}

// Simulation runner for SOC analysis
async function runSimulation(sessionId: string, ai: AIService): Promise<void> {
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const session = await ai.getSession(sessionId);
    if (!session) return;

    const steps = session.steps.sort((a, b) => a.order - b.order);

    for (const step of steps) {
      await delay(500);
      await ai.updateStepContent(
        step.id,
        `## ${step.title}\n\n已完成 ${step.title} 分析。`
      );
      await delay(2000);
      await ai.completeStep(step.id);
    }

    await ai.completeSession(sessionId);
  } catch (error) {
    console.error('Simulation error:', error);
    // Mark session as error on failure
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'error' },
    });
  }
}

// Real SOC analysis runner - triggers MiniMax AI analysis
async function triggerSOCAnalysis(sessionId: string, rawContent: string, ai: AIService): Promise<void> {
  try {
    const session = await ai.getSession(sessionId);
    if (!session) return;

    const steps = session.steps.sort((a, b) => a.order - b.order);

    // Update first step to running
    if (steps.length > 0) {
      await ai.updateStepContent(
        steps[0].id,
        `正在接收並分析安全告警...`
      );
    }

    // Send the analysis prompt to MiniMax
    const prompt = `請分析以下安全告警數據，生成結構化威脅報告。

${rawContent}

【報告格式要求】
1. 首先輸出威脅判定：⚠️ 風險等級 + 攻擊類型
2. 六章報告結構：事件概要、IOC、ATT&CK、技術分析、業務影響、處置建議
3. ⚠️ 標註待確認資訊（IP、帳戶）並列為最優先
4. 禁止重複內容`;

    await ai.sendMessage(sessionId, prompt);

    // AI analysis is complete (sendMessage handles step completion internally)
    console.log(`SOC analysis completed for session ${sessionId}`);
  } catch (error) {
    console.error('SOC analysis error:', error);
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

// Generate PDF report for SOC session
async function generateSOCReportPDF(session: { id: string; input?: unknown; createdAt: string; steps: { title: string; content?: string; status: string }[]; messages: { role: string; content: string; createdAt: string }[] }, reportContent: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `SOC Analysis Report - ${session.id}`,
          Author: 'SecurityWeb SOC System',
          Subject: 'Security Incident Analysis Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = '#1a365d';
      const accentColor = '#2b6cb0';
      const textColor = '#2d3748';
      const lightGray = '#718096';

      // Extract threat info from report content
      const threatMatch = reportContent.match(/[⚠️🔴]\s*\*?([^\n*]+)/);
      const threatType = threatMatch ? threatMatch[1].trim() : '未知威脅';

      const severityMatch = reportContent.match(/(?:嚴重性|風險等級)[：:]\s*([^\n]+)/i);
      const severity = severityMatch ? severityMatch[1].trim() : '高';

      // ===== COVER PAGE =====
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7fafc');
      doc.fillColor(primaryColor).fontSize(36).font('Helvetica-Bold');
      doc.text('SECURITY INCIDENT', 50, 120, { align: 'center' });
      doc.text('ANALYSIS REPORT', 50, 170, { align: 'center' });

      doc.fillColor(accentColor).fontSize(24).font('Helvetica');
      doc.text('安全事件威脅分析報告', 50, 250, { align: 'center' });

      // Threat type badge
      doc.fillColor('#c53030').fontSize(16).font('Helvetica-Bold');
      doc.text(`⚠️ ${threatType}`, 50, 310, { align: 'center' });

      doc.fillColor(textColor).fontSize(14).font('Helvetica');
      doc.text(`報告 ID：${session.id}`, 50, 380, { align: 'center' });
      doc.text(`分析時間：${new Date(session.createdAt).toLocaleString('zh-TW')}`, 50, 410, { align: 'center' });
      doc.text(`嚴重等級：${severity}`, 50, 440, { align: 'center' });

      // Footer
      doc.fontSize(12).fillColor(lightGray);
      doc.text('SecurityWeb SOC Automation System', 50, doc.page.height - 100, { align: 'center' });
      doc.text('All Rights Reserved', 50, doc.page.height - 80, { align: 'center' });

      // ===== EXECUTIVE SUMMARY =====
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('1. 事件概要 (EXECUTIVE SUMMARY)', 50, 50);

      doc.moveTo(50, 90).lineTo(280, 90).lineWidth(3).stroke(primaryColor);

      // Extract sections from report
      const section1Match = reportContent.match(/(?:一|1[.、])[^#]*事件概要[\s\S]*?(?=(?:二|##|$))/i);
      const eventOverview = section1Match ? section1Match[0].replace(/^[^#]*事件概要/i, '').substring(0, 1500) : '無法解析事件概要';

      doc.fillColor(textColor).fontSize(12).font('Helvetica');
      doc.text(eventOverview, 50, 110, { width: 495, align: 'left' });

      // Threat verdict
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold');
      doc.text('威脅判定', 50, 280);

      doc.fillColor('#c53030').fontSize(14).font('Helvetica-Bold');
      doc.text(`⚠️ ${threatType}`, 50, 310);
      doc.fillColor(textColor).fontSize(12).font('Helvetica');
      doc.text(`嚴重等級：${severity}`, 50, 340);

      // ===== IOC SECTION =====
      const iocMatch = reportContent.match(/(?:二|2[.、])[^#]*IOC[^$]+/i);
      if (iocMatch && iocMatch[0].length > 50) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

        doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
        doc.text('2. IOC 威脅指標 (INDICATORS OF COMPROMISE)', 50, 50);

        doc.moveTo(50, 90).lineTo(320, 90).lineWidth(3).stroke(primaryColor);

        doc.fillColor(textColor).fontSize(11).font('Helvetica');
        doc.text(iocMatch[0].substring(0, 2500), 50, 110, { width: 495 });
      }

      // ===== ATT&CK =====
      const attckMatch = reportContent.match(/(?:三|3[.、])[^#]*ATT&CK[^$]+/i);
      if (attckMatch && attckMatch[0].length > 50) {
        doc.addPage();
        doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
        doc.text('3. ATT&CK 戰術映射', 50, 50);

        doc.moveTo(50, 90).lineTo(250, 90).lineWidth(3).stroke(primaryColor);

        doc.fillColor(textColor).fontSize(11).font('Helvetica');
        doc.text(attckMatch[0].substring(0, 2000), 50, 110, { width: 495 });
      }

      // ===== TECHNICAL ANALYSIS =====
      const techMatch = reportContent.match(/(?:四|4[.、])[^#]*技術分析[\s\S]*?(?=(?:五|##|$))/i);
      if (techMatch && techMatch[0].length > 50) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

        doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
        doc.text('4. 技術分析 (TECHNICAL ANALYSIS)', 50, 50);

        doc.moveTo(50, 90).lineTo(280, 90).lineWidth(3).stroke(primaryColor);

        doc.fillColor(textColor).fontSize(11).font('Helvetica');
        doc.text(techMatch[0].substring(0, 2500), 50, 110, { width: 495 });
      }

      // ===== BUSINESS IMPACT =====
      const impactMatch = reportContent.match(/(?:五|5[.、])[^#]*業務影響[\s\S]*?(?=(?:六|##|$))/i);
      if (impactMatch && impactMatch[0].length > 50) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

        doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
        doc.text('5. 業務影響評估 (BUSINESS IMPACT)', 50, 50);

        doc.moveTo(50, 90).lineTo(300, 90).lineWidth(3).stroke(primaryColor);

        doc.fillColor(textColor).fontSize(11).font('Helvetica');
        doc.text(impactMatch[0].substring(0, 2000), 50, 110, { width: 495 });
      }

      // ===== REMEDIATION =====
      const remMatch = reportContent.match(/(?:六|6[.、])[^#]*處置建議[\s\S]*$/i);
      if (remMatch && remMatch[0].length > 50) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

        doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
        doc.text('6. 處置建議 (REMEDIATION RECOMMENDATIONS)', 50, 50);

        doc.moveTo(50, 90).lineTo(340, 90).lineWidth(3).stroke(primaryColor);

        const remContent = remMatch[0];
        const numberedItems = remContent.match(/\d+[.、][^\n]+/g) || [];

        let yPos = 110;
        for (const item of numberedItems.slice(0, 15)) {
          doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold');
          doc.text(item.substring(0, 80), 55, yPos);
          yPos += 25;
          if (yPos > 700) break;
        }

        const warningItems = remContent.match(/⚠️[^\n]+/g) || [];
        if (warningItems.length > 0) {
          yPos += 20;
          doc.fillColor('#c53030').fontSize(12).font('Helvetica-Bold');
          doc.text('⚠️ 最優先處置項目：', 50, yPos);
          yPos += 25;

          for (const item of warningItems.slice(0, 5)) {
            doc.fillColor(textColor).fontSize(10).font('Helvetica');
            doc.text(item.substring(0, 90), 55, yPos);
            yPos += 20;
            if (yPos > 700) break;
          }
        }
      }

      // ===== APPENDIX =====
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('7. 附錄 (APPENDIX)', 50, 50);

      doc.moveTo(50, 90).lineTo(150, 90).lineWidth(3).stroke(primaryColor);

      doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold');
      doc.text('工作階段資訊', 50, 110);

      doc.font('Helvetica').fontSize(11).fillColor(textColor);
      doc.text(`Session ID: ${session.id}`, 50, 135);
      doc.text(`Created: ${new Date(session.createdAt).toLocaleString('zh-TW')}`, 50, 155);
      doc.text(`Module: SOC Analysis`, 50, 175);

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('分析步驟狀態', 50, 210);

      doc.font('Helvetica').fontSize(11).fillColor(textColor);
      let stepY = 235;
      for (const step of session.steps) {
        const statusIcon = step.status === 'success' ? '✅' : step.status === 'running' ? '🔄' : '⏳';
        doc.text(`${statusIcon} ${step.title}: ${step.status}`, 55, stepY);
        stepY += 20;
        if (stepY > 700) break;
      }

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('報告元數據', 50, stepY + 20);

      doc.font('Helvetica').fontSize(11).fillColor(textColor);
      doc.text(`報告生成時間: ${new Date().toISOString()}`, 50, stepY + 45);
      doc.text(`分析系統: SecurityWeb SOC Automation`, 50, stepY + 65);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
