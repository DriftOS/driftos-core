import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register Swagger
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Fastify Gold Standard API',
        description: 'Production-ready Fastify starter with TypeScript, Prisma, and Docker',
        version: '1.0.0',
      },
      // Don't set servers - let Swagger UI auto-detect from browser URL
      // Tags are optional - Swagger auto-discovers them from routes!
      // Define tags here only if you want to control order or add descriptions
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Users', description: 'User management endpoints' },
        {
          name: 'Todos',
          description: 'Todo management (demonstrates Golden Orchestrator pattern)',
        },
        {
          name: 'Example',
          description: 'Example CRUD endpoints (demonstrates direct Prisma access)',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  // Register Swagger UI
  if (fastify.config.SWAGGER_ENABLED) {
    await fastify.register(fastifySwaggerUI, {
      routePrefix: fastify.config.SWAGGER_PATH,
      uiConfig: {
        docExpansion: 'none',
        deepLinking: true,
        persistAuthorization: true,
        // Safari compatibility
        tryItOutEnabled: true,
      },
      // Disable staticCSP for better Safari compatibility
      staticCSP: false,
      transformSpecification: (swaggerObject, _req, _reply) => {
        // Create a copy without host for Safari compatibility
        const spec = { ...swaggerObject };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete spec.host;
        return spec;
      },
    });
  }
};

export default fp(swaggerPlugin, {
  name: 'swagger',
  dependencies: ['env'],
});
