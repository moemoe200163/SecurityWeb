import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { requireUser } from '../middleware/rbac.js';

const OTX_API_KEY = process.env.OTX_API_KEY;
const OTX_BASE_URL = 'https://otx.alienvault.com/api/v1';

const querySchema = z.object({
  indicator: z.string().min(1),
  type: z.enum(['IPv4', 'IPv6', 'domain', 'hostname', 'file', 'url']).optional().default('domain'),
  forceRefresh: z.boolean().optional().default(false),
});

// Helper: Track API usage
async function trackApiUsage(apiName: string): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await prisma.apiUsage.upsert({
      where: {
        apiName_date: {
          apiName,
          date: today,
        },
      },
      create: {
        apiName,
        date: today,
        requestCount: 1,
      },
      update: {
        requestCount: { increment: 1 },
      },
    });

    if (usage.requestCount > usage.dailyLimit) {
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error tracking API usage:', error);
    return true;
  }
}

// Helper: Query OTX directly
async function queryOTXDirect(indicator: string, type: string): Promise<any> {
  if (!OTX_API_KEY) {
    return { error: 'OTX API key not configured' };
  }

  try {
    const url = new URL(`${OTX_BASE_URL}/indicators/${type}/${encodeURIComponent(indicator)}`);
    const response = await fetch(url.toString(), {
      headers: {
        'X-OTX-API-KEY': OTX_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { error: 'RATE_LIMIT_EXCEEDED', detail: 'AlienVault OTX API rate limit exceeded' };
      }
      if (response.status === 404) {
        return { error: 'NOT_FOUND', detail: 'Indicator not found in OTX' };
      }
      return { error: `OTX error: ${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function otxRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/otx/check?indicator=xxx&type=domain - Direct OTX query
  fastify.get('/check', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const { indicator, type, forceRefresh } = querySchema.parse(request.query);

      // Build cache key based on indicator and type
      const cacheKey = `otx_${type}_${indicator}`;

      // Check if we have cached data
      if (!forceRefresh) {
        const cached = await prisma.otxResult.findUnique({
          where: { indicatorType: cacheKey }
        });

        // Cache valid for 24 hours
        if (cached && cached.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          return reply.send({
            indicator,
            type,
            ...cached.data as object,
            cached: true,
            updatedAt: cached.updatedAt
          });
        }
      }

      // Check API quota
      const quotaOk = await trackApiUsage('OTX');
      if (!quotaOk) {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員'
        });
      }

      // Query OTX API
      const data = await queryOTXDirect(indicator, type);

      if (data?.error === 'RATE_LIMIT_EXCEEDED') {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員'
        });
      }

      if (data?.error === 'NOT_FOUND') {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Indicator not found in OTX'
        });
      }

      if (data?.error) {
        return reply.status(500).send({
          error: data.error
        });
      }

      // Extract relevant fields from OTX response
      const pulseInfo = data.pulse_info || {};
      const relevantData = {
        indicator,
        type,
        pulseCount: pulseInfo.count || 0,
        pulses: (pulseInfo.pulses || []).map((pulse: any) => ({
          id: pulse.id,
          name: pulse.name,
          description: pulse.description,
          tags: pulse.tags,
          created: pulse.created,
          modified: pulse.modified,
          indicatorCount: pulse.indicator_count
        })),
        country: data.country || null,
        city: data.city || null,
        asn: data.asn || null,
        hostname: data.hostname || null,
        url: data.url || null,
        mimeType: data.mime_type || null,
        dhash: data.dhash || null,
        ssdeep: data.ssdeep || null,
        fileType: data.file_type || null,
        fileSize: data.file_size || null,
        malware: data.malware || null,
        analysis: data.analysis || null,
        ufdst: data.ufdst || null
      };

      // Cache result
      await prisma.otxResult.upsert({
        where: { indicatorType: cacheKey },
        create: {
          indicatorType: cacheKey,
          indicator,
          type,
          data: relevantData
        },
        update: {
          data: relevantData
        }
      });

      return reply.send({
        ...relevantData,
        cached: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors
        });
      }
      console.error('OTX check error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/otx/pulse/:pulseId - Get specific pulse details
  fastify.get('/pulse/:pulseId', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const { pulseId } = request.params as { pulseId: string };

      if (!OTX_API_KEY) {
        return reply.status(500).send({
          error: 'OTX API key not configured'
        });
      }

      const quotaOk = await trackApiUsage('OTX');
      if (!quotaOk) {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員'
        });
      }

      const url = `${OTX_BASE_URL}/pulses/${pulseId}`;
      const response = await fetch(url, {
        headers: {
          'X-OTX-API-KEY': OTX_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: 'Pulse not found'
          });
        }
        return reply.status(500).send({
          error: `OTX API error: ${response.status}`
        });
      }

      const data = await response.json();
      return reply.send(data);
    } catch (error) {
      console.error('OTX pulse error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/otx/search - Search for indicators
  fastify.get('/search', { preHandler: [apiKeyAuth, requireUser] }, async (request, reply) => {
    try {
      const query = request.query as Record<string, string>;
      const keyword = query.keyword || '';

      if (!keyword) {
        return reply.status(400).send({
          error: 'keyword parameter is required'
        });
      }

      if (!OTX_API_KEY) {
        return reply.status(500).send({
          error: 'OTX API key not configured'
        });
      }

      const quotaOk = await trackApiUsage('OTX');
      if (!quotaOk) {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員'
        });
      }

      const url = new URL(`${OTX_BASE_URL}/search`);
      url.searchParams.set('query', keyword);

      const response = await fetch(url.toString(), {
        headers: {
          'X-OTX-API-KEY': OTX_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return reply.status(500).send({
          error: `OTX API error: ${response.status}`
        });
      }

      const data = await response.json();
      return reply.send({
        results: data.results || [],
        count: data.count || 0
      });
    } catch (error) {
      console.error('OTX search error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
