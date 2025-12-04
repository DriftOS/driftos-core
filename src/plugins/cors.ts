import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const origins = fastify.config.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  await fastify.register(fastifyCors, {
    origin: origins,
    credentials: fastify.config.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
  });
};

export default fp(corsPlugin, {
  name: 'cors',
  dependencies: ['env'],
});
