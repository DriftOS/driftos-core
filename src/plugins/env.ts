import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import { Type, Static } from '@sinclair/typebox';

// Define environment schema
const envSchema = Type.Object({
  NODE_ENV: Type.String({ default: 'development' }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  LOG_LEVEL: Type.String({ default: 'info' }),

  // Database
  DATABASE_URL: Type.String(),

  // Authentication
  JWT_SECRET: Type.String(),
  JWT_EXPIRES_IN: Type.String({ default: '7d' }),

  // API
  API_PREFIX: Type.String({ default: '/api' }),
  API_VERSION: Type.String({ default: 'v1' }),

  // Rate Limiting
  RATE_LIMIT_MAX: Type.Number({ default: 100 }),
  RATE_LIMIT_TIME_WINDOW: Type.Number({ default: 60000 }),

  // CORS
  CORS_ORIGIN: Type.String({ default: 'http://localhost:3001,http://localhost:3000' }),
  CORS_CREDENTIALS: Type.Boolean({ default: true }),

  // Monitoring
  METRICS_ENABLED: Type.Boolean({ default: true }),
  METRICS_PATH: Type.String({ default: '/metrics' }),

  // Swagger
  SWAGGER_ENABLED: Type.Boolean({ default: true }),
  SWAGGER_PATH: Type.String({ default: '/documentation' }),
});

export type Env = Static<typeof envSchema>;

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}

export default fp(
  async function envPlugin(fastify) {
    await fastify.register(fastifyEnv, {
      confKey: 'config',
      schema: envSchema,
      dotenv: true,
      data: process.env,
    });
  },
  {
    name: 'env',
  }
);
