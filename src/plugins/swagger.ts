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
        title: 'DriftOS Core API',
        description:
          'Conversation routing and context management for AI applications. Route messages to semantic branches, extract structured facts with provenance, and assemble optimized LLM context.',
        version: '1.0.0',
      },
      // Don't set servers - let Swagger UI auto-detect from browser URL
      // Tags are optional - Swagger auto-discovers them from routes!
      // Define tags here only if you want to control order or add descriptions
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Drift', description: 'Message routing and branch management for conversations.' },
        {
          name: 'Facts',
          description: 'Extract and retrieve structured facts from branch messages.',
        },
        { name: 'Context', description: 'Assemble optimized LLM context from branches and facts.' },
      ],
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
