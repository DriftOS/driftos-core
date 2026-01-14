import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { logger } from './utils/logger.js';

// Import plugins
import envPlugin from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import metricsPlugin from './plugins/metrics.js';
import swaggerPlugin from './plugins/swagger.js';
import authPlugin from './plugins/auth.js';

// Import routes
import rootRoutes from './routes/root.js';
import healthRoutes from './routes/health/index';
import driftRoutes from './routes/drift/index';
import factsRoutes from './routes/facts/index';
import contextRoutes from './routes/context/index';
import llmRoutes from './routes/llm/index';
import demoRoutes from './routes/demo/index';
import conversationsRoutes from './routes/conversations/index';

export async function buildApp() {
  const app = Fastify({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    loggerInstance: logger as any,
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: true, // Disable verbose request/response logging
    routerOptions: {
      maxParamLength: 200,
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins
  await app.register(envPlugin);
  await app.register(corsPlugin);
  await app.register(prismaPlugin);
  await app.register(metricsPlugin);
  await app.register(swaggerPlugin);
  await app.register(authPlugin);

  const sensiblePlugin = await import('@fastify/sensible');
  await app.register(sensiblePlugin.default);

  const helmetPlugin = await import('@fastify/helmet');
  await app.register(helmetPlugin.default, {
    contentSecurityPolicy: false,
  });

  // NOTE: Rate limiting is handled by the gateway in production
  // This service is internal-only and should only receive traffic from the gateway
  // Keeping rate limit config in env for backwards compatibility, but not applying it

  await app.register(rootRoutes);

  await app.register(
    async function apiRoutes(fastify) {
      await fastify.register(healthRoutes);
      await fastify.register(driftRoutes, { prefix: '/drift' });
      await fastify.register(factsRoutes, { prefix: '/facts' });
      await fastify.register(contextRoutes, { prefix: '/context' });
      await fastify.register(llmRoutes, { prefix: '/llm' });
      await fastify.register(demoRoutes, { prefix: '/demo' });
      await fastify.register(conversationsRoutes, { prefix: '/conversations' });
    },
    { prefix: `${app.config.API_PREFIX}/${app.config.API_VERSION}` }
  );

  app.setErrorHandler(async (error: Error & { statusCode?: number }, request, reply) => {
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

  app.addHook('onClose', () => {
    logger.info('Server is shutting down...');
  });

  return app;
}
