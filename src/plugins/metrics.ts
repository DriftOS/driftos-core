import fp from 'fastify-plugin';
import { collectDefaultMetrics, register, Counter, Histogram, Gauge } from 'prom-client';
import type { FastifyPluginAsync } from 'fastify';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    metrics: {
      register: typeof register;
      httpRequestDuration: Histogram<string>;
      httpRequestsTotal: Counter<string>;
      httpRequestsInProgress: Gauge<string>;
    };
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
const metricsPlugin: FastifyPluginAsync = async (fastify, _options) => {
  // Collect default metrics
  collectDefaultMetrics({ register });

  // Create custom metrics
  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
  });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  const httpRequestsInProgress = new Gauge({
    name: 'http_requests_in_progress',
    help: 'Number of HTTP requests in progress',
    labelNames: ['method'],
  });

  // Register metrics
  register.registerMetric(httpRequestDuration);
  register.registerMetric(httpRequestsTotal);
  register.registerMetric(httpRequestsInProgress);

  // Decorate fastify with metrics
  fastify.decorate('metrics', {
    register,
    httpRequestDuration,
    httpRequestsTotal,
    httpRequestsInProgress,
  });

  // Add hooks to track metrics
  fastify.addHook('onRequest', async (request, _reply) => {
    // Track in-progress requests
    httpRequestsInProgress.labels({ method: request.method }).inc();

    // Start timer for request duration
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    // Calculate request duration
    const duration = Date.now() - (request.startTime || Date.now());
    const route = request.routeOptions?.config?.url || request.url;
    const labels = {
      method: request.method,
      route: route,
      status_code: reply.statusCode.toString(),
    };

    // Record metrics
    httpRequestDuration.labels(labels).observe(duration / 1000);
    httpRequestsTotal.labels(labels).inc();
    httpRequestsInProgress.labels({ method: request.method }).dec();
  });

  // Add metrics endpoint
  if (fastify.config.METRICS_ENABLED) {
    fastify.get(fastify.config.METRICS_PATH, async (_request, reply) => {
      const metrics = await register.metrics();
      return reply.type(register.contentType).send(metrics);
    });
  }
};

// Extend request type
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

export default fp(metricsPlugin, {
  name: 'metrics',
  dependencies: ['env'],
});
