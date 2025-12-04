import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { logger } from './utils/logger.js';

// Import plugins
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import metricsPlugin from './plugins/metrics.js';
import swaggerPlugin from './plugins/swagger.js';

// Import routes
import rootRoutes from './routes/root.js';
import healthRoutes from './routes/health/index';
import authRoutes from './routes/auth/index';
import userRoutes from './routes/users/index';
import exampleRoutes from './routes/example/index';
import todoRoutes from './routes/todos/index';

export async function buildApp() {
  const app = Fastify({
    logger: logger as any, // Cast to any to fix type mismatch
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    maxParamLength: 200,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins in correct order
  await app.register(envPlugin);
  await app.register(corsPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(metricsPlugin);
  await app.register(swaggerPlugin);

  // Register sensible plugin for useful decorators
  const sensiblePlugin = await import('@fastify/sensible');
  await app.register(sensiblePlugin.default);

  // Register helmet for security headers
  const helmetPlugin = await import('@fastify/helmet');
  await app.register(helmetPlugin.default, {
    contentSecurityPolicy: false, // Configure as needed
  });

  // Register rate limiting
  const rateLimitPlugin = await import('@fastify/rate-limit');
  await app.register(rateLimitPlugin.default, {
    max: app.config.RATE_LIMIT_MAX,
    timeWindow: app.config.RATE_LIMIT_TIME_WINDOW,
  });

  // Root route (no prefix)
  await app.register(rootRoutes);

  // API prefix wrapper
  await app.register(
    async function apiRoutes(fastify) {
      // Health routes (no auth required)
      await fastify.register(healthRoutes);

      // Auth routes
      await fastify.register(authRoutes, { prefix: '/auth' });

      // Protected routes
      await fastify.register(userRoutes, { prefix: '/users' });

      // Example routes (demonstrates direct Prisma access for simple CRUD)
      await fastify.register(exampleRoutes, { prefix: '/examples' });

      // Todo routes (demonstrates Golden Orchestrator pattern)
      await fastify.register(todoRoutes, { prefix: '/todos' });
    },
    { prefix: `${app.config.API_PREFIX}/${app.config.API_VERSION}` }
  );

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error });

    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      error: {
        message: error.message || 'Internal Server Error',
        statusCode,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    };

    return reply.status(statusCode).send(response);
  });

  // Not found handler
  app.setNotFoundHandler((request, reply) => {
    const response = {
      success: false,
      error: {
        message: 'Route not found',
        statusCode: 404,
        requestId: request.id,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    return reply.status(404).send(response);
  });

  // Graceful shutdown hooks
  app.addHook('onClose', async () => {
    logger.info('Server is shutting down...');
  });

  return app;
}
