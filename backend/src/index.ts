import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectDatabase, prisma } from './db/client.js';
import { socRoutes } from './routes/soc.js';
import { threatRoutes } from './routes/threat.js';
import { pentestRoutes } from './routes/pentest.js';
import { ipReputationRoutes } from './routes/ipReputation.js';
import { bgpRoutes } from './routes/bgp.js';
import { urlhausRoutes } from './routes/urlhaus.js';
import { otxRoutes } from './routes/otx.js';
import { reportRoutes } from './routes/report.js';
import { settingsRoutes } from './routes/settings.js';
import { toolRoutes } from './routes/tools.js';
import { adminRoutes } from './routes/admin.js';
import { alertRoutes } from './routes/alerts.js';
import { evidenceRoutes } from './routes/evidence.js';
import { dashboardRoutes } from './routes/dashboard.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

async function startServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Connect to database
  await connectDatabase();

  // Register routes
  fastify.register(socRoutes, { prefix: '/api/soc' });
  fastify.register(threatRoutes, { prefix: '/api/threat' });
  fastify.register(pentestRoutes, { prefix: '/api/pentest' });
  fastify.register(ipReputationRoutes, { prefix: '/api/ip' });
  fastify.register(bgpRoutes, { prefix: '/api/bgp' });
  fastify.register(urlhausRoutes, { prefix: '/api/urlhaus' });
  fastify.register(otxRoutes, { prefix: '/api/otx' });
  fastify.register(reportRoutes, { prefix: '/api/report' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });

  // Tool execution routes (protected by API key + RBAC)
  fastify.register(toolRoutes, { prefix: '/api/tools' });

  // Admin routes (protected by API key + admin role)
  fastify.register(adminRoutes, { prefix: '/api/admin' });

  // Alert routes
  fastify.register(alertRoutes, { prefix: '/api/alerts' });

  // Evidence routes (linked to sessions)
  fastify.register(evidenceRoutes, { prefix: '/api/sessions' });

  // Dashboard / Stats routes
  fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log('Shutting down gracefully...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

startServer();
