import fp from 'fastify-plugin';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/v1/demo/stream', // Demo streaming endpoint - rate limited by IP
  '/api/v1/demo/chat', // Demo chat with drift - rate limited by IP
  '/api/v1/demo/route', // Demo chat with drift - rate limited by IP
  '/api/v1/health', // Health checks for infrastructure
  '/health', // Root health check
  '/', // Root route
  '/documentation', // Swagger docs
  '/metrics', // Prometheus metrics
];

// Check if a route should skip authentication
function isPublicRoute(url: string): boolean {
  // Remove query string for matching
  const path = url.split('?')[0];

  return PUBLIC_ROUTES.some((route) => {
    // Exact match or starts with (for nested routes like /documentation/*)
    return path === route || path?.startsWith(`${route}/`);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    sessionId?: string;
  }
}

export default fp(
  async function authPlugin(fastify) {
    const clerkSecretKey = fastify.config.CLERK_SECRET_KEY;
    const clerkPublishableKey = fastify.config.CLERK_PUBLISHABLE_KEY;

    if (!clerkSecretKey || !clerkPublishableKey) {
      fastify.log.warn(
        'CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY not configured - authentication disabled'
      );
      return;
    }

    // Register the official Clerk Fastify plugin
    await fastify.register(clerkPlugin, {
      publishableKey: clerkPublishableKey,
      secretKey: clerkSecretKey,
    });

    // Add authentication hook for protected routes
    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for OPTIONS requests (CORS preflight)
      if (request.method === 'OPTIONS') {
        return;
      }

      // Skip auth for public routes
      if (isPublicRoute(request.url)) {
        fastify.log.debug({ url: request.url }, 'Public route - skipping auth');
        return;
      }

      fastify.log.debug({ url: request.url }, 'Protected route - checking auth');

      // TEMP: Bypass auth for local testing
      if (process.env.NODE_ENV === 'development') {
        fastify.log.warn('⚠️  AUTH BYPASSED - development mode');
        request.userId = 'dev-user-123';
        return;
      }

      // Check for userId from gateway (proxied requests)
      const gatewayUserId = request.headers['x-user-id'] as string | undefined;

      if (gatewayUserId) {
        // Request is coming from the gateway with pre-authenticated user
        fastify.log.debug({ userId: gatewayUserId }, 'Gateway auth - using x-user-id header');
        request.userId = gatewayUserId;
        return;
      }

      // Otherwise, use Clerk's getAuth() to verify the request
      const authResult = getAuth(request);
      const { userId, sessionId } = authResult;

      fastify.log.debug(
        {
          authResult: JSON.stringify(authResult),
          hasAuth: !!request.headers.authorization,
        },
        'Auth check result'
      );

      if (!userId) {
        fastify.log.warn(
          {
            url: request.url,
            authHeader: request.headers.authorization?.substring(0, 50),
          },
          'Auth failed - no userId'
        );
        return reply.status(401).send({
          success: false,
          error: {
            message: 'Unauthorized - please sign in',
            statusCode: 401,
          },
        });
      }

      // Attach user info to request for downstream use
      request.userId = userId;
      request.sessionId = sessionId ?? undefined;

      fastify.log.debug({ userId }, 'Request authenticated');
    });

    fastify.log.info('Clerk authentication plugin registered');
  },
  {
    name: 'auth',
    dependencies: ['env'], // Must load after env plugin
  }
);
