import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/client.js';

const URLHAUS_API_BASE_URL = 'https://urlhaus-api.abuse.ch/api/v1';

const querySchema = z.object({
  domain: z.string().min(1),
  forceRefresh: z.boolean().optional().default(false),
});

// Helper: Query URLhaus API
async function queryUrlhaus(domain: string): Promise<any> {
  try {
    const url = new URL(`${URLHAUS_API_BASE_URL}/host/${encodeURIComponent(domain)}`);
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { notFound: true };
      }
      return { error: `URLhaus API error: ${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function urlhausRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/urlhaus/check?domain=xxx - Check domain on URLhaus
  fastify.get('/check', async (request, reply) => {
    try {
      const { domain, forceRefresh } = querySchema.parse(request.query);

      // Check if we have cached data
      if (!forceRefresh) {
        const cached = await prisma.urlHausResult.findUnique({
          where: { domain }
        });

        // Cache valid for 24 hours
        if (cached && cached.updatedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          return reply.send({
            domain,
            malicious: cached.malicious,
            status: cached.status,
            threatType: cached.threatType,
            blacklists: cached.blacklists,
            urlCount: cached.urlCount,
            lastSeen: cached.lastSeen,
            firstSeen: cached.firstSeen,
            cannedResponse: cached.cannedResponse,
            cached: true,
            updatedAt: cached.updatedAt
          });
        }
      }

      // Query URLhaus API
      const data = await queryUrlhaus(domain);

      if (data?.error) {
        return reply.status(500).send({
          error: data.error
        });
      }

      if (data?.notFound) {
        return reply.send({
          domain,
          malicious: false,
          status: 'clean',
          threatType: null,
          blacklists: [],
          urlCount: 0,
          lastSeen: null,
          firstSeen: null,
          cannedResponse: null,
          cached: false,
          updatedAt: new Date().toISOString()
        });
      }

      // Parse URLhaus response
      // ref: https://urlhaus-api.abuse.ch/docs/

      // Query status
      //  - "online" - at least one URL of the host is online
      //  - "offline" - all URLs of the host are offline
      //  - "unknown" - no information about host status
      const status = data.query_status === 'ok' ? (data.http_status_code === 200 ? 'online' : 'offline') : 'unknown';

      // Determine if malicious
      // malware_url: at least one URL on the host distributes malware
      // phishing_url: at least one URL on the host is used for phishing
      // phishing_site: at least one URL on the host is used for phishing and the TLD is used for phishing
      // malware_site: at least one URL on the host is confirmed as malware site
      // benign: host is confirmed benign (e.g. Google)
      // no verdict: no verdict could be derived for this host
      const isMalicious = ['malware_url', 'phishing_url', 'phishing_site', 'malware_site'].includes(data.verdict);

      const threatType = data.verdict === 'no verdict' ? null : data.verdict;

      // Build blacklists info
      const blacklists: Array<{ name: string; count: number; lastseen: string | null }> = [];
      if (data.blacklists) {
        if (data.blacklists.denial_of_service?.entries > 0) {
          blacklists.push({
            name: 'denial_of_service',
            count: data.blacklists.denial_of_service.entries,
            lastseen: data.blacklists.denial_of_service.lastseen || null
          });
        }
        if (data.blacklists.malware_download?.entries > 0) {
          blacklists.push({
            name: 'malware_download',
            count: data.blacklists.malware_download.entries,
            lastseen: data.blacklists.malware_download.lastseen || null
          });
        }
        if (data.blacklists.phishing?.entries > 0) {
          blacklists.push({
            name: 'phishing',
            count: data.blacklists.phishing.entries,
            lastseen: data.blacklists.phishing.lastseen || null
          });
        }
        if (data.blacklists.spam?.entries > 0) {
          blacklists.push({
            name: 'spam',
            count: data.blacklists.spam.entries,
            lastseen: data.blacklists.spam.lastseen || null
          });
        }
      }

      // URL count
      const urlCount = data.url_count || 0;

      // Last seen / first seen
      const lastSeen = data.lastseen || null;
      const firstSeen = data.firstseen || null;

      // Canned response (original API response for reference)
      const cannedResponse = data.canned_response || null;

      // Upsert to database
      const record = await prisma.urlHausResult.upsert({
        where: { domain },
        create: {
          domain,
          malicious: isMalicious,
          status,
          threatType,
          blacklists,
          urlCount,
          lastSeen: lastSeen ? new Date(lastSeen) : null,
          firstSeen: firstSeen ? new Date(firstSeen) : null,
          cannedResponse
        },
        update: {
          malicious: isMalicious,
          status,
          threatType,
          blacklists,
          urlCount,
          lastSeen: lastSeen ? new Date(lastSeen) : null,
          firstSeen: firstSeen ? new Date(firstSeen) : null,
          cannedResponse
        }
      });

      return reply.send({
        domain,
        malicious: record.malicious,
        status: record.status,
        threatType: record.threatType,
        blacklists: record.blacklists,
        urlCount: record.urlCount,
        lastSeen: record.lastSeen,
        firstSeen: record.firstSeen,
        cannedResponse: record.cannedResponse,
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
      console.error('URLhaus check error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/urlhaus/recent - Get recent malicious URLs (public endpoint)
  fastify.get('/recent', async (request, reply) => {
    try {
      const limit = Math.min(parseInt((request.query as any).limit) || 10, 50);

      const response = await fetch(`${URLHAUS_API_BASE_URL}/recent/urlslimit/${limit}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return reply.status(500).send({ error: 'Failed to fetch recent URLs' });
      }

      const data = await response.json();
      return reply.send({
        urls: data.urls || [],
        generated_at: data.generated_at
      });
    } catch (error) {
      console.error('URLhaus recent error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
