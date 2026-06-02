import type { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';
import { prisma } from '../db/client.js';

export async function dashboardRoutes(fastify: FastifyInstance): Promise<void> {
  // Dashboard stats / metrics
  fastify.get(
    '/stats',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Alert stats
        const [
          totalAlerts,
          newAlerts,
          investigatingAlerts,
          resolvedAlerts,
          falsePositiveAlerts,
          alertsLast7Days,
          alertsBySeverity,
        ] = await Promise.all([
          prisma.alert.count(),
          prisma.alert.count({ where: { status: 'new' } }),
          prisma.alert.count({ where: { status: 'investigating' } }),
          prisma.alert.count({ where: { status: 'resolved' } }),
          prisma.alert.count({ where: { status: 'false_positive' } }),
          prisma.alert.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
          prisma.alert.groupBy({
            by: ['severity'],
            _count: { id: true },
          }),
        ]);

        // Tool execution stats
        const [
          totalExecutions,
          successExecutions,
          errorExecutions,
          avgDurationMs,
          execLast7Days,
        ] = await Promise.all([
          prisma.toolExecution.count(),
          prisma.toolExecution.count({ where: { status: 'success' } }),
          prisma.toolExecution.count({ where: { status: 'error' } }),
          prisma.toolExecution.aggregate({
            _avg: { durationMs: true },
            where: { status: { in: ['success', 'error'] } },
          }),
          prisma.toolExecution.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        ]);

        // Knowledge feedback stats (AI vs human correction rate)
        const feedbacks = await prisma.knowledgeFeedback.findMany({
          select: { aiVerdict: true, correctVerdict: true },
        });
        const totalFeedback = feedbacks.length;
        const correctedByHuman = feedbacks.filter(f => f.aiVerdict !== f.correctVerdict).length;

        // Calculate rates
        const falsePositiveRate = totalAlerts > 0
          ? Math.round((falsePositiveAlerts / totalAlerts) * 100)
          : 0;
        const toolSuccessRate = totalExecutions > 0
          ? Math.round((successExecutions / totalExecutions) * 100)
          : 0;
        const humanCorrectionRate = totalFeedback > 0
          ? Math.round((correctedByHuman / totalFeedback) * 100)
          : 0;
        const resolutionRate = totalAlerts > 0
          ? Math.round(((resolvedAlerts + falsePositiveAlerts) / totalAlerts) * 100)
          : 0;

        // Recent tool executions
        const recentExecutions = await prisma.toolExecution.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            template: { select: { name: true, tool: true } },
          },
        });

        // Recent alerts
        const recentAlerts = await prisma.alert.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        });

        return reply.send({
          metrics: {
            alerts: {
              total: totalAlerts,
              new: newAlerts,
              investigating: investigatingAlerts,
              resolved: resolvedAlerts,
              falsePositive: falsePositiveAlerts,
              last7Days: alertsLast7Days,
              falsePositiveRate,
              resolutionRate,
              bySeverity: alertsBySeverity.reduce((acc, item) => {
                acc[item.severity] = item._count.id;
                return acc;
              }, {} as Record<string, number>),
            },
            tools: {
              total: totalExecutions,
              success: successExecutions,
              error: errorExecutions,
              successRate: toolSuccessRate,
              avgDurationMs: Math.round(avgDurationMs._avg?.durationMs || 0),
              last7Days: execLast7Days,
            },
            feedback: {
              total: totalFeedback,
              correctedByHuman,
              correctionRate: humanCorrectionRate,
            },
          },
          recentExecutions,
          recentAlerts,
        });
      } catch (error) {
        console.error('Dashboard stats error:', error);
        return reply.status(500).send({ error: 'Failed to get dashboard stats' });
      }
    }
  );

  // Alert resolution rate over time
  fastify.get(
    '/stats/timeline',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { days = 7 } = request.query as { days?: number };
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const alerts = await prisma.alert.findMany({
          where: {
            createdAt: { gte: startDate },
          },
          select: {
            createdAt: true,
            status: true,
            severity: true,
          },
        });

        // Group by day
        const timeline: Record<string, {
          total: number;
          resolved: number;
          falsePositive: number;
          bySeverity: Record<string, number>;
        }> = {};

        for (const alert of alerts) {
          const day = alert.createdAt.toISOString().split('T')[0];
          if (!timeline[day]) {
            timeline[day] = { total: 0, resolved: 0, falsePositive: 0, bySeverity: {} };
          }
          timeline[day].total++;
          if (alert.status === 'resolved') timeline[day].resolved++;
          if (alert.status === 'false_positive') timeline[day].falsePositive++;
          if (!timeline[day].bySeverity[alert.severity]) {
            timeline[day].bySeverity[alert.severity] = 0;
          }
          timeline[day].bySeverity[alert.severity]++;
        }

        return reply.send({ timeline });
      } catch (error) {
        console.error('Timeline stats error:', error);
        return reply.status(500).send({ error: 'Failed to get timeline stats' });
      }
    }
  );

  // Export investigation report
  fastify.get(
    '/report/:alertId',
    { preHandler: [apiKeyAuth, requireUser] },
    async (request, reply) => {
      try {
        const { alertId } = request.params as { alertId: string };

        const alert = await prisma.alert.findUnique({
          where: { id: alertId },
          include: {
            knowledgeFeedback: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!alert) {
          return reply.status(404).send({ error: 'Alert not found' });
        }

        // Get related tool executions for this alert's session
        const toolExecutions = alert.sessionId
          ? await prisma.toolExecution.findMany({
              where: { sessionId: alert.sessionId },
              orderBy: { createdAt: 'asc' },
              include: {
                template: { select: { name: true, tool: true, riskLevel: true } },
              },
            })
          : [];

        // Get audit logs related to this alert
        const auditLogs = await prisma.auditLog.findMany({
          where: {
            OR: [
              { resourceType: 'alert', resourceId: alertId },
              { resourceType: 'tool_template', resourceId: { in: toolExecutions.map(e => e.templateId) } },
            ],
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });

        // Build report
        const report = {
          metadata: {
            generatedAt: new Date().toISOString(),
            reportVersion: '1.0',
          },
          alert: {
            id: alert.id,
            title: alert.title,
            source: alert.source,
            severity: alert.severity,
            status: alert.status,
            createdAt: alert.createdAt.toISOString(),
            updatedAt: alert.updatedAt.toISOString(),
          },
          aiAnalysis: {
            verdict: alert.aiVerdict,
            rawContent: alert.rawContent,
            normalizedFields: alert.normalizedFields,
          },
          humanAnalysis: {
            verdict: alert.humanVerdict,
            hasCorrections: alert.humanVerdict && alert.humanVerdict !== alert.aiVerdict,
          },
          toolExecutionSummary: {
            total: toolExecutions.length,
            successful: toolExecutions.filter(e => e.status === 'success').length,
            failed: toolExecutions.filter(e => e.status === 'error').length,
            executions: toolExecutions
              .filter(e => e.template)
              .map(e => ({
                tool: e.template!.name,
                toolType: e.template!.tool,
                riskLevel: e.template!.riskLevel,
                status: e.status,
                durationMs: e.durationMs,
                output: e.output,
                error: e.error,
                executedAt: e.createdAt.toISOString(),
              })),
          },
          knowledgeFeedback: alert.knowledgeFeedback.map(fb => ({
            aiVerdict: fb.aiVerdict,
            correctVerdict: fb.correctVerdict,
            errorReason: fb.errorReason,
            lesson: fb.lesson,
            createdAt: fb.createdAt.toISOString(),
          })),
          auditTrail: auditLogs.map(log => ({
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            details: log.details,
            timestamp: log.createdAt.toISOString(),
          })),
          recommendations: generateRecommendations(alert, toolExecutions),
        };

        return reply.send(report);
      } catch (error) {
        console.error('Generate report error:', error);
        return reply.status(500).send({ error: 'Failed to generate report' });
      }
    }
  );
}

function generateRecommendations(alert: any, executions: any[]): string[] {
  const recommendations: string[] = [];

  if (alert.severity === 'critical' || alert.severity === 'high') {
    recommendations.push('建議立即進行影響範圍評估');
  }

  if (alert.status === 'false_positive') {
    recommendations.push('建議更新檢測規則以減少誤報');
  }

  if (alert.aiVerdict === 'attack_attempt' && alert.humanVerdict !== 'legitimate') {
    recommendations.push('建議封禁攻擊來源 IP');
    recommendations.push('建議檢查相關系統是否有被入侵跡象');
  }

  if (executions.some(e => e.status === 'error')) {
    recommendations.push('部分工具執行失敗，建議檢查工具配置');
  }

  if (!recommendations.length) {
    recommendations.push('持續監控該類型告警');
  }

  return recommendations;
}