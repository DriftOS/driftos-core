import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

// eslint-disable-next-line @typescript-eslint/require-await
const rootRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        hide: true, // Hide from Swagger docs - it's an HTML page, not an API endpoint
      },
    },
    (_request, reply) => {
      const baseUrl = `${_request.protocol}://${_request.hostname}`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fastify Gold Standard Starter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 60px 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #2d3748;
      font-size: 2.5rem;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .subtitle {
      color: #718096;
      font-size: 1.1rem;
      margin-bottom: 40px;
    }
    .links {
      display: grid;
      gap: 15px;
      margin-bottom: 30px;
    }
    .link {
      display: block;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 600;
      transition: all 0.3s ease;
      text-align: center;
    }
    .link:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }
    .footer {
      text-align: center;
      color: #a0aec0;
      font-size: 0.9rem;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    .badge {
      display: inline-block;
      background: #48bb78;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Fastify API <span class="badge">LIVE</span></h1>
    <p class="subtitle">Production-ready TypeScript starter with best practices</p>
    
    <div class="links">
      <a href="${baseUrl}/documentation" class="link">📖 API Documentation (Swagger)</a>
      <a href="${baseUrl}${fastify.config.API_PREFIX}/${fastify.config.API_VERSION}/health" class="link">🏥 Health Check</a>
      <a href="${baseUrl}/metrics" class="link">📊 Prometheus Metrics</a>
    </div>
    
    <div class="footer">
      Built with <a href="https://github.com/DriftOS/fastify-starter" target="_blank">Fastify Gold Standard</a>
      <br>
      <small>TypeScript • Prisma • PostgreSQL • Docker</small>
    </div>
  </div>
</body>
</html>
    `;

      return reply.type('text/html').send(html);
    }
  );
};

export default rootRoutes;
