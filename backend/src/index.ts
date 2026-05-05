import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectDatabase, prisma } from './db/client.js';
import { socRoutes } from './routes/soc.js';
import { threatRoutes } from './routes/threat.js';
import { pentestRoutes } from './routes/pentest.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

async function startServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // Connect to database
  await connectDatabase();

  // Register routes
  fastify.register(socRoutes, { prefix: '/api/soc' });
  fastify.register(threatRoutes, { prefix: '/api/threat' });
  fastify.register(pentestRoutes, { prefix: '/api/pentest' });

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
