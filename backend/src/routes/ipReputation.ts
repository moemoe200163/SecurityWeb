import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
const OTX_API_KEY = process.env.OTX_API_KEY;
const ABUSEIPDB_BASE_URL = 'https://api.abuseipdb.com/api/v2';
const OTX_BASE_URL = 'https://otx.alienvault.com/api/v1';

const querySchema = z.object({
  ip: z.string().min(1),
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

    // Check if over limit
    if (usage.requestCount > usage.dailyLimit) {
      return false; // Over limit
    }
    return true;
  } catch (error) {
    console.error('Error tracking API usage:', error);
    return true; // Allow request on error
  }
}

// Helper: Get remaining API quota
async function getRemainingQuota(apiName: string): Promise<{ remaining: number; limit: number; resetAt: Date }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await prisma.apiUsage.findUnique({
      where: {
        apiName_date: {
          apiName,
          date: today,
        },
      },
    });

    const limit = 1000; // Default daily limit
    return {
      remaining: usage ? Math.max(0, limit - usage.requestCount) : limit,
      limit,
      resetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    return { remaining: 1000, limit: 1000, resetAt: new Date() };
  }
}

// Helper: Query AbuseIPDB
async function queryAbuseIPDB(ipAddress: string): Promise<any> {
  if (!ABUSEIPDB_API_KEY) {
    return { error: 'AbuseIPDB API key not configured' };
  }

  try {
    const url = new URL(`${ABUSEIPDB_BASE_URL}/check`);
    url.searchParams.set('ipAddress', ipAddress);
    url.searchParams.set('maxAgeInDays', '90');

    const response = await fetch(url.toString(), {
      headers: {
        'Key': ABUSEIPDB_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        return { error: 'RATE_LIMIT_EXCEEDED', detail: 'AbuseIPDB API rate limit exceeded' };
      }
      return { error: `AbuseIPDB error: ${response.status}` };
    }

    const data = await response.json();
    return data.data;
  } catch (error: any) {
    return { error: error.message };
  }
}

// Helper: Query AlienVault OTX
async function queryOTX(ipAddress: string): Promise<any> {
  if (!OTX_API_KEY) {
    return { error: 'OTX API key not configured' };
  }

  try {
    const url = new URL(`${OTX_BASE_URL}/indicators/IPv4/${ipAddress}`);
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
      return { error: `OTX error: ${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

// Helper: Determine threat level from combined sources
function determineThreatLevel(
  abuseScore: number | null,
  otxPulses: number
): { status: string; threatLevel: string } {
  // AbuseIPDB confidence score: 0-100
  // OTX pulse count
  let maxScore = 0;

  if (abuseScore !== null) {
    maxScore = Math.max(maxScore, abuseScore);
  }

  // OTX pulses indicate known malicious activity
  if (otxPulses > 0) {
    maxScore = Math.max(maxScore, 50 + Math.min(otxPulses * 10, 50));
  }

  if (maxScore >= 75) {
    return { status: 'malicious', threatLevel: 'high' };
  } else if (maxScore >= 50) {
    return { status: 'suspicious', threatLevel: 'medium' };
  } else if (maxScore >= 25) {
    return { status: 'suspicious', threatLevel: 'low' };
  } else {
    return { status: 'normal', threatLevel: 'none' };
  }
}

export async function ipReputationRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/ip/check?ip=1.1.1.1 - Check IP reputation
  fastify.get('/check', async (request, reply) => {
    try {
      const { ip, forceRefresh } = querySchema.parse(request.query);

      // Check if we have cached data
      if (!forceRefresh) {
        const cached = await prisma.ipReputation.findUnique({
          where: { ipAddress: ip }
        });

        // Cache valid for 24 hours
        if (cached && cached.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          return reply.send({
            ip,
            status: cached.status,
            threatLevel: cached.threatLevel,
            confidenceScore: cached.confidenceScore,
            sources: cached.sources,
            cached: true,
            updatedAt: cached.updatedAt
          });
        }
      }

      // Query external APIs
      const [abuseQuotaOk, otxQuotaOk] = await Promise.all([
        trackApiUsage('AbuseIPDB'),
        trackApiUsage('OTX'),
      ]);

      if (!abuseQuotaOk) {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AbuseIPDB API 使用上限，請聯絡管理員',
          source: 'AbuseIPDB'
        });
      }
      if (!otxQuotaOk) {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員',
          source: 'OTX'
        });
      }

      const [abuseData, otxData] = await Promise.all([
        queryAbuseIPDB(ip),
        queryOTX(ip)
      ]);

      // Check for rate limit errors
      if (abuseData?.error === 'RATE_LIMIT_EXCEEDED') {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AbuseIPDB API 使用上限，請聯絡管理員',
          source: 'AbuseIPDB'
        });
      }
      if (otxData?.error === 'RATE_LIMIT_EXCEEDED') {
        return reply.status(429).send({
          error: 'API使用上限',
          message: 'AlienVault OTX API 使用上限，請聯絡管理員',
          source: 'OTX'
        });
      }

      const abuseScore = abuseData?.abuseConfidenceScore ?? null;
      const otxPulses = otxData?.pulse_info?.count ?? 0;

      const { status, threatLevel } = determineThreatLevel(abuseScore, otxPulses);

      // Build sources summary
      const sources = [];
      if (abuseData && !abuseData.error) {
        sources.push({
          name: 'AbuseIPDB',
          confidenceScore: abuseScore,
          totalReports: abuseData.totalReports,
          lastReported: abuseData.lastReportedAt
        });
      }
      if (otxData && !otxData.error) {
        sources.push({
          name: 'AlienVault OTX',
          pulseCount: otxPulses
        });
      }

      // Upsert to database
      const record = await prisma.ipReputation.upsert({
        where: { ipAddress: ip },
        create: {
          ipAddress: ip,
          status,
          threatLevel,
          confidenceScore: abuseScore,
          countryCode: abuseData?.countryCode || otxData?.country_code,
          countryName: abuseData?.countryName || otxData?.country,
          isp: abuseData?.isp || otxData?.asn,
          domain: abuseData?.domain,
          usageType: abuseData?.usageType,
          totalReports: abuseData?.totalReports,
          lastReportedAt: abuseData?.lastReportedAt ? new Date(abuseData.lastReportedAt) : null,
          isWhitelisted: abuseData?.isWhitelisted || false,
          sources: sources,
          firstSeen: otxData?.firstseen ? new Date(otxData.firstseen) : null,
          lastSeen: otxData?.lastseen ? new Date(otxData.lastseen) : null
        },
        update: {
          status,
          threatLevel,
          confidenceScore: abuseScore,
          countryCode: abuseData?.countryCode || otxData?.country_code,
          countryName: abuseData?.countryName || otxData?.country,
          isp: abuseData?.isp || otxData?.asn,
          domain: abuseData?.domain,
          usageType: abuseData?.usageType,
          totalReports: abuseData?.totalReports,
          lastReportedAt: abuseData?.lastReportedAt ? new Date(abuseData.lastReportedAt) : null,
          isWhitelisted: abuseData?.isWhitelisted || false,
          sources: sources,
          firstSeen: otxData?.firstseen ? new Date(otxData.firstseen) : null,
          lastSeen: otxData?.lastseen ? new Date(otxData.lastseen) : null
        }
      });

      return reply.send({
        ip,
        status: record.status,
        threatLevel: record.threatLevel,
        confidenceScore: record.confidenceScore,
        countryCode: record.countryCode,
        countryName: record.countryName,
        isp: record.isp,
        totalReports: record.totalReports,
        isWhitelisted: record.isWhitelisted,
        sources,
        cached: false,
        updatedAt: record.updatedAt
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors
        });
      }
      console.error('IP check error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/ip/history - Get recent IP checks
  fastify.get('/history', async (request, reply) => {
    try {
      const history = await prisma.ipReputation.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50
      });

      // Map ipAddress to ip for frontend compatibility
      let mappedHistory = history.map(record => ({
        ip: record.ipAddress,
        status: record.status,
        threatLevel: record.threatLevel,
        confidenceScore: record.confidenceScore,
        countryCode: record.countryCode,
        countryName: record.countryName,
        isp: record.isp,
        domain: record.domain,
        usageType: record.usageType,
        totalReports: record.totalReports,
        isWhitelisted: record.isWhitelisted,
        sources: record.sources,
        cached: true,
        updatedAt: record.updatedAt
      }));

      // If no data, return empty array
      if (mappedHistory.length === 0) {
        mappedHistory = [];
      }

      return reply.send({ history: mappedHistory });
    } catch (error) {
      console.error('IP history error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/ip/stats - Get statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const [total, malicious, suspicious, normal] = await Promise.all([
        prisma.ipReputation.count(),
        prisma.ipReputation.count({ where: { status: 'malicious' } }),
        prisma.ipReputation.count({ where: { status: 'suspicious' } }),
        prisma.ipReputation.count({ where: { status: 'normal' } })
      ]);

      // Return actual database stats
      return reply.send({
        total,
        malicious,
        suspicious,
        normal,
        unknown: total - malicious - suspicious - normal
      });
    } catch (error) {
      console.error('IP stats error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/ip/blacklist - Get paginated blacklist
  fastify.get('/blacklist', async (request, reply) => {
    try {
      const query = request.query as Record<string, string>;
      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 50, 100);
      const status = query.status;
      const search = query.search;

      // Validate sortBy against allowlist to prevent Prisma errors
      const allowedSortFields = ['updatedAt', 'createdAt', 'ipAddress', 'status', 'threatLevel', 'confidenceScore', 'totalReports', 'lastReportedAt'];
      const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'updatedAt';

      // Validate sortOrder to be only 'asc' or 'desc'
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

      const where: any = {};
      if (status && status !== 'all') {
        where.status = status;
      }
      if (search) {
        where.ipAddress = { contains: search };
      }

      const [total, records] = await Promise.all([
        prisma.ipReputation.count({ where }),
        prisma.ipReputation.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      // Map ipAddress to ip for frontend compatibility
      const data = records.map(record => ({
        ip: record.ipAddress,
        status: record.status,
        threatLevel: record.threatLevel,
        confidenceScore: record.confidenceScore,
        countryCode: record.countryCode,
        countryName: record.countryName,
        isp: record.isp,
        domain: record.domain,
        usageType: record.usageType,
        totalReports: record.totalReports,
        isWhitelisted: record.isWhitelisted,
        sources: record.sources,
        cached: true,
        updatedAt: record.updatedAt
      }));

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Blacklist error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/ip/quota - Get API usage quota
  fastify.get('/quota', async (request, reply) => {
    try {
      const [abuseQuota, otxQuota] = await Promise.all([
        getRemainingQuota('AbuseIPDB'),
        getRemainingQuota('OTX'),
      ]);

      return reply.send({
        AbuseIPDB: abuseQuota,
        OTX: otxQuota
      });
    } catch (error) {
      console.error('IP quota error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
