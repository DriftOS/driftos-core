import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Singleton instance - exported for use outside Fastify context
export const prisma = new PrismaClient({
  log: ['error'], // Only log errors - queries are too noisy
});

const prismaPlugin: FastifyPluginAsync = async (fastify, _options) => {
  // Connect to database
  await prisma.$connect();

  // Decorate Fastify instance with same instance
  fastify.decorate('prisma', prisma);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});
