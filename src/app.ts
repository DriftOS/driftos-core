import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { logger } from './utils/logger.js';

// Import plugins
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import metricsPlugin from './plugins/metrics.js';
import swaggerPlugin from './plugins/swagger.js';

// Import routes
import rootRoutes from './routes/root.js';
import healthRoutes from './routes/health/index';
import driftRoutes from './routes/drift/index';
import factsRoutes from './routes/facts/index';
import contextRoutes from './routes/context/index';

export async function buildApp() {
  const app = Fastify({
    logger: logger as any,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true, // Disable verbose request/response logging
    maxParamLength: 200,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins
  await app.register(envPlugin);
  await app.register(corsPlugin);
  await app.register(prismaPlugin);
  await app.register(metricsPlugin);
  await app.register(swaggerPlugin);

  const sensiblePlugin = await import('@fastify/sensible');
  await app.register(sensiblePlugin.default);

  const helmetPlugin = await import('@fastify/helmet');
  await app.register(helmetPlugin.default, {
    contentSecurityPolicy: false,
  });

  const rateLimitPlugin = await import('@fastify/rate-limit');
  await app.register(rateLimitPlugin.default, {
    max: app.config.RATE_LIMIT_MAX,
    timeWindow: app.config.RATE_LIMIT_TIME_WINDOW,
  });

  await app.register(rootRoutes);

  await app.register(
    async function apiRoutes(fastify) {
      await fastify.register(healthRoutes);
      await fastify.register(driftRoutes, { prefix: '/drift' });
      await fastify.register(factsRoutes, { prefix: '/facts' });
      await fastify.register(contextRoutes, { prefix: '/context' });
    },
    { prefix: `${app.config.API_PREFIX}/${app.config.API_VERSION}` }
  );

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error });
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        message: error.message || 'Internal Server Error',
        statusCode,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: {
        message: 'Route not found',
        statusCode: 404,
        requestId: request.id,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  });

  app.addHook('onClose', async () => {
    logger.info('Server is shutting down...');
  });

  return app;
}
