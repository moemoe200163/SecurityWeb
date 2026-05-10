import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';
import dns from 'dns';
import { promisify } from 'util';
import https from 'https';

const dnsLookup = promisify(dns.lookup);

interface WhoisCache {
  data: any;
  timestamp: number;
}

interface HijackSuspicion {
  hijack_suspicion: boolean;
  suspicion_level: 'none' | 'low' | 'medium' | 'high';
  suspicion_reasons: string[];
}

// Helper to force IPv4 for RIPEstat API using native https module
async function fetchWithIPv4(urlStr: string, options?: RequestInit & { signal?: AbortSignal }): Promise<Response> {
  const urlObj = new URL(urlStr);
  const hostname = urlObj.hostname;
  const path = urlObj.pathname + urlObj.search;

  // Resolve hostname to IPv4
  const { address } = await dnsLookup(hostname, { family: 4 });

  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: address,
      port: 443,
      path,
      method: options?.method || 'GET',
      headers: {
        'Host': hostname,
        ...Object.fromEntries(new Headers(options?.headers || {})),
      },
      timeout: options?.signal ? undefined : 15000,
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve(new Response(body, {
          status: res.statusCode || 200,
          headers: res.headers as HeadersInit,
        }));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      });
    }

    if (options?.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function checkHijackSuspicion(
  prefix: string,
  originAsn: bigint,
  timestamp: Date
): Promise<HijackSuspicion> {
  const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);

  const differentOrigins = await prisma.bgpUpdate.findMany({
    where: {
      prefix: prefix,
      timestamp: {
        gte: oneHourAgo,
        lte: timestamp,
      },
      originAsn: {
        not: originAsn,
      },
    },
    select: {
      originAsn: true,
    },
    distinct: ['originAsn'],
  });

  if (differentOrigins.length === 0) {
    return {
      hijack_suspicion: false,
      suspicion_level: 'none',
      suspicion_reasons: [],
    };
  }

  const reason = `同一前綴 1 小時內出現 ${differentOrigins.length + 1} 個不同 Origin ASN`;

  let suspicion_level: 'low' | 'medium' | 'high';
  if (differentOrigins.length === 1) {
    suspicion_level = 'low';
  } else if (differentOrigins.length === 2) {
    suspicion_level = 'medium';
  } else {
    suspicion_level = 'high';
  }

  return {
    hijack_suspicion: true,
    suspicion_level,
    suspicion_reasons: [reason],
  };
}

const whoisCache = new Map<string, WhoisCache>();
const WHOIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function bgpRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/bgp/query - 查詢 BGP 更新記錄
  fastify.get('/query', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const prefix = query.prefix;
    const asn = query.asn ? BigInt(query.asn) : undefined;
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 50, 100);
    const startTime = query.start_time ? new Date(query.start_time) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: any = {
      timestamp: { gte: startTime }
    };
    if (prefix) {
      where.prefix = { contains: prefix };
    }
    if (asn) {
      where.originAsn = asn;
    }

    const [total, records] = await Promise.all([
      prisma.bgpUpdate.count({ where }),
      prisma.bgpUpdate.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
    ]);

    // 取得所有涉及的唯一 originASN
    const originAsnSet = new Set<string>();
    records.forEach(r => {
      if (r.originAsn) originAsnSet.add(r.originAsn.toString());
    });

    // 批次查詢 BgpAsnInfo
    const asnInfos = await prisma.bgpAsnInfo.findMany({
      where: {
        asn: { in: Array.from(originAsnSet).map(BigInt) }
      }
    });
    const asnInfoMap = new Map(asnInfos.map(info => [info.asn.toString(), info]));

    const data = await Promise.all(
      records.map(async (r) => {
        const suspicion = await checkHijackSuspicion(
          r.prefix,
          r.originAsn ?? BigInt(0),
          r.timestamp
        );
        const asnInfo = r.originAsn ? asnInfoMap.get(r.originAsn.toString()) : null;
        return {
          id: r.id.toString(),
          prefix: r.prefix,
          asPath: r.asPath,
          peerAsn: r.peerAsn?.toString(),
          originAsn: r.originAsn?.toString(),
          timestamp: r.timestamp,
          type: r.type,
          source: r.source,
          country: r.country,
          org: asnInfo?.name || null,
          ...suspicion,
        };
      })
    );

    return reply.send({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // GET /api/bgp/stats - 取得統計資料
  fastify.get('/stats', async (request, reply) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, announces, withdraws, uniquePrefixes, uniqueAsns] = await Promise.all([
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since } } }),
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since }, type: 'A' } }),
      prisma.bgpUpdate.count({ where: { timestamp: { gte: since }, type: 'W' } }),
      prisma.bgpUpdate.groupBy({
        by: ['prefix'],
        where: { timestamp: { gte: since } },
        _count: true,
      }),
      prisma.bgpUpdate.groupBy({
        by: ['originAsn'],
        where: { timestamp: { gte: since }, originAsn: { not: null } },
      }),
    ]);

    return reply.send({
      totalUpdates: total,
      announces,
      withdraws,
      uniquePrefixes: uniquePrefixes.length,
      uniqueAsns: uniqueAsns.length,
      since: since.toISOString(),
    });
  });

  // GET /api/bgp/whois/:asn - 查詢 ASN WHOIS 資訊
  fastify.get('/whois/:asn', async (request, reply) => {
    const { asn } = request.params as { asn: string };
    const asnNumber = asn.replace(/^AS/i, '');

    // 檢查快取
    const cached = whoisCache.get(asnNumber);
    if (cached && Date.now() - cached.timestamp < WHOIS_CACHE_TTL) {
      return reply.send(cached.data);
    }

    try {
      // 並行查詢 as-overview 和 rir-geo
      const [overviewResponse, geoResponse] = await Promise.all([
        fetchWithIPv4(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asnNumber}`),
        fetchWithIPv4(`https://stat.ripe.net/data/rir-geo/data.json?resource=AS${asnNumber}`),
      ]);

      if (!overviewResponse.ok || !geoResponse.ok) {
        return reply.status(502).send({ error: 'Failed to fetch from RIPEstat' });
      }

      const [ripeOverview, ripeGeo] = await Promise.all([
        overviewResponse.json(),
        geoResponse.json(),
      ]);

      const overviewData = ripeOverview.data;
      const geoData = ripeGeo.data;

      // 從 rir-geo 取得國家
      let country: string | null = null;
      if (geoData?.located_resources) {
        for (const r of geoData.located_resources) {
          if (r.resource === asnNumber) {
            country = r.location;
            break;
          }
        }
      }

      const result = {
        asn: asnNumber,
        holder: overviewData.holder || null,
        country,
        block: overviewData.block ? `${overviewData.block.start}-${overviewData.block.end}` : null,
        block_desc: overviewData.block?.desc || null,
        type: overviewData.type || null,
      };

      // 快取結果
      whoisCache.set(asnNumber, { data: result, timestamp: Date.now() });

      return reply.send(result);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/bgp/prefixes/:asn - 查询 ASN 宣告的前缀
  fastify.get('/prefixes/:asn', async (request, reply) => {
    const { asn } = request.params as { asn: string };
    const asnNumber = asn.replace(/^AS/i, '');
    const asnBigInt = BigInt(asnNumber);

    try {
      // 方案 1: 从本地数据库查询
      const localPrefixes = await prisma.bgpUpdate.findMany({
        where: { originAsn: asnBigInt, type: 'A' },
        select: { prefix: true },
        distinct: 'prefix',
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      const localPrefixList = localPrefixes.map(p => p.prefix).filter(Boolean);

      // 方案 2: 从 RIPE Stat API 获取（如果本地数据不足）
      let ripePrefixes: Array<{ prefix: string; type: string }> = [];
      if (localPrefixList.length < 5) {
        try {
          const response = await fetchWithIPv4(
            `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asnNumber}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.data?.prefixes) {
              ripePrefixes = data.data.prefixes.map((p: { prefix: string }) => ({
                prefix: p.prefix,
                type: p.prefix.includes(':') ? 'ipv6' : 'ipv4',
              }));
            }
          }
        } catch {
          // RIPE API 失败，使用本地数据
        }
      }

      // 合并数据（去重）
      const allPrefixes = [...new Set([...localPrefixList, ...ripePrefixes.map(p => p.prefix)])];
      const prefixes = ripePrefixes.length > 0
        ? ripePrefixes
        : localPrefixList.map(p => ({ prefix: p, type: p.includes(':') ? 'ipv6' : 'ipv4' }));

      return reply.send({
        asn: asnNumber,
        prefixes: prefixes.slice(0, 1000),
        count: prefixes.length,
        source: localPrefixList.length > 0 ? 'local' : 'ripe',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/bgp/lookup - 查詢任意 IP/前綴的 BGP 資訊 (使用 RIPEstat)
  fastify.get('/lookup', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const resource = query.resource || query.ip || query.prefix;

    if (!resource) {
      return reply.status(400).send({ error: 'Missing resource parameter (ip or prefix)' });
    }

    // 驗證是否為有效的 IP、前綴或 ASN
    const isValidIP = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(resource) ||
                      /^([0-9a-fA-F:]+)(\/\d{1,3})?$/.test(resource);
    const isValidASN = /^AS?\d+$/i.test(resource) || /^\d+$/.test(resource);
    if (!isValidIP && !isValidASN) {
      return reply.status(400).send({ error: 'Invalid IP address, prefix, or ASN format' });
    }

    // 檢查網路連線
    const checkNetwork = async () => {
      try {
        await fetchWithIPv4('https://stat.ripe.net', { signal: AbortSignal.timeout(3000) });
        return true;
      } catch {
        return false;
      }
    };

    try {
      // 先檢查網路
      const networkOk = await checkNetwork();
      if (!networkOk) {
        return reply.status(503).send({
          error: '無法連線到 RIPEstat API，請檢查網路連線',
          hint: 'BGP 查詢服務需要存取 stat.ripe.net'
        });
      }

      let result: any;

      if (isValidASN) {
        // ASN 查詢 - 使用 as-overview API
        const asnNumber = resource.replace(/^AS/i, '');
        const [overviewResponse, geoResponse] = await Promise.all([
          fetchWithIPv4(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asnNumber}`, {
            signal: AbortSignal.timeout(15000)
          }),
          fetchWithIPv4(`https://stat.ripe.net/data/rir-geo/data.json?resource=AS${asnNumber}`, {
            signal: AbortSignal.timeout(15000)
          }),
        ]);

        if (!overviewResponse.ok || !geoResponse.ok) {
          return reply.status(502).send({ error: 'Failed to fetch from RIPEstat' });
        }

        const [ripeOverview, ripeGeo] = await Promise.all([
          overviewResponse.json(),
          geoResponse.json(),
        ]);

        const overviewData = ripeOverview.data;
        const geoData = ripeGeo.data;

        // 從 rir-geo 取得國家
        let country: string | null = null;
        if (geoData?.located_resources) {
          for (const r of geoData.located_resources) {
            if (r.resource === asnNumber) {
              country = r.location;
              break;
            }
          }
        }

        result = {
          resource: `AS${asnNumber}`,
          type: 'asn',
          announced: true,
          asns: [{
            asn: parseInt(asnNumber),
            holder: overviewData.holder || null,
            country,
          }],
          block: overviewData.block ? {
            resource: `${overviewData.block.start}-${overviewData.block.end}`,
            desc: overviewData.block.desc || null,
          } : null,
        };
      } else {
        // IP/前綴查詢 - 使用 prefix-overview API
        const response = await fetchWithIPv4(
          `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(resource)}`,
          { signal: AbortSignal.timeout(15000) }
        );

        if (!response.ok) {
          return reply.status(502).send({ error: 'Failed to fetch from RIPEstat' });
        }

        const data = await response.json();

        if (data.status !== 'ok') {
          return reply.status(404).send({ error: 'No BGP data found for this resource' });
        }

        result = {
          resource: data.data.resource,
          type: data.data.type,
          announced: data.data.announced,
          asns: data.data.asns || [],
          block: data.data.block,
        };
      }

      return reply.send(result);
    } catch (error: any) {
      fastify.log.error(error);
      if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
        return reply.status(504).send({ error: 'RIPEstat API 查詢逾時' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
