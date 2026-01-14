import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import { Type, Static } from '@sinclair/typebox';

const envSchema = Type.Object({
  NODE_ENV: Type.String({ default: 'development' }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '::' }),
  LOG_LEVEL: Type.String({ default: 'info' }),

  // Database
  DATABASE_URL: Type.String(),

  // API
  API_PREFIX: Type.String({ default: '/api' }),
  API_VERSION: Type.String({ default: 'v1' }),

  // Rate Limiting
  RATE_LIMIT_MAX: Type.Number({ default: 100 }),
  RATE_LIMIT_TIME_WINDOW: Type.Number({ default: 60000 }),

  // Demo Endpoint Rate Limiting
  DEMO_RATE_LIMIT: Type.Number({ default: 10 }),
  DEMO_RATE_WINDOW: Type.Number({ default: 60000 }),

  // CORS
  CORS_ORIGIN: Type.String({ default: 'http://localhost:3001,http://localhost:3000' }),
  CORS_CREDENTIALS: Type.Boolean({ default: true }),

  // Monitoring
  METRICS_ENABLED: Type.Boolean({ default: true }),
  METRICS_PATH: Type.String({ default: '/metrics' }),

  // Swagger
  SWAGGER_ENABLED: Type.Boolean({ default: true }),
  SWAGGER_PATH: Type.String({ default: '/documentation' }),

  // Drift Policies
  DRIFT_MAX_BRANCHES_CONTEXT: Type.Number({ default: 10 }),

  // Embeddings
  EMBEDDING_MODEL: Type.String({ default: 'Xenova/all-MiniLM-L6-v2' }),

  // LLM (Legacy - kept for backward compatibility)
  LLM_PROVIDER: Type.String({ default: 'groq' }),
  LLM_MODEL: Type.String({ default: 'llama-3.1-8b-instant' }),
  LLM_API_KEY: Type.String({ default: '' }),
  LLM_TIMEOUT: Type.Number({ default: 5000 }),

  // Operation-specific LLM Models
  DRIFT_ROUTING_MODEL: Type.String({ default: 'meta-llama/llama-4-scout-17b-16e-instruct' }),
  FACT_EXTRACTION_MODEL: Type.String({ default: 'llama-3.1-8b-instant' }),
  CHAT_MODEL: Type.String({ default: 'llama-3.1-8b-instant' }),
  DEMO_MODEL: Type.String({ default: '' }), // Falls back to CHAT_MODEL

  // LLM Provider API Keys
  GROQ_API_KEY: Type.String({ default: '' }),
  OPENAI_API_KEY: Type.String({ default: '' }),
  ANTHROPIC_API_KEY: Type.String({ default: '' }),

  // Clerk Authentication
  CLERK_SECRET_KEY: Type.String({ default: '' }),
  CLERK_PUBLISHABLE_KEY: Type.String({ default: '' }),
});

export type Env = Static<typeof envSchema>;

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

    // Set DEMO_MODEL fallback to CHAT_MODEL if not specified
    if (!fastify.config.DEMO_MODEL) {
      fastify.config.DEMO_MODEL = fastify.config.CHAT_MODEL;
    }

    // Set the config for non-Fastify contexts
    setConfig(fastify.config);
  },
  {
    name: 'env',
  }
);

// src/plugins/env.ts - add at bottom
let config: Env | null = null;

export function setConfig(c: Env) {
  config = c;
}
export function getConfig(): Env {
  if (!config) throw new Error('Config not initialized');
  return config;
}
