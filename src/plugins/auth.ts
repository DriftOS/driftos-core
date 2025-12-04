import fp from 'fastify-plugin';
import fastifyAuth from '@fastify/auth';
import fastifyJWT from '@fastify/jwt';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// JWT payload type
export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

// Extend JWT namespace
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Register JWT plugin
  await fastify.register(fastifyJWT, {
    secret: fastify.config.JWT_SECRET,
    sign: {
      expiresIn: fastify.config.JWT_EXPIRES_IN,
    },
  });

  // Register auth plugin
  await fastify.register(fastifyAuth);

  // Authentication decorator
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        success: false,
        error: {
          message: 'Unauthorized',
          statusCode: 401,
        },
      });
    }
  });

  // Authorization decorator (example for role-based auth)
  fastify.decorate('authorize', (roles: string[]) => {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: {
            message: 'Unauthorized',
            statusCode: 401,
          },
        });
      }

      if (!roles.includes(request.user.role)) {
        return reply.status(403).send({
          success: false,
          error: {
            message: 'Forbidden',
            statusCode: 403,
          },
        });
      }
    };
  });
};

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['env'],
});
