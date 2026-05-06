import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';

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

    return reply.send({
      data: records.map(r => ({
        id: r.id.toString(),
        prefix: r.prefix,
        asPath: r.asPath,
        peerAsn: r.peerAsn?.toString(),
        originAsn: r.originAsn?.toString(),
        timestamp: r.timestamp,
        type: r.type,
        source: r.source,
        country: r.country,
      })),
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
}
