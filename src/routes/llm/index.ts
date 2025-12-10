import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

// Provider endpoints
const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

// Demo endpoint constants - hardcoded for security
const DEMO_MODEL = 'llama-3.1-8b-instant';
const DEMO_MAX_TOKENS = 256;
const DEMO_MAX_SYSTEM_PROMPT_LENGTH = 500;
const DEMO_MAX_MESSAGES = 20;
const DEMO_MAX_MESSAGE_LENGTH = 2000; // per message content limit
const DEMO_ALLOWED_ROLES = ['user', 'assistant']; // prevent system role injection

// Simple in-memory rate limiter for demo endpoint
const demoRateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkDemoRateLimit(ip: string, limit: number, window: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = demoRateLimiter.get(ip);

  if (!record || now > record.resetAt) {
    demoRateLimiter.set(ip, { count: 1, resetAt: now + window });
    return { allowed: true, remaining: limit - 1, resetIn: window };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetIn: record.resetAt - now,
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of demoRateLimiter.entries()) {
    if (now > record.resetAt) {
      demoRateLimiter.delete(ip);
    }
  }
}, 60 * 1000);

const llmRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Proxy streaming chat requests to LLM providers
  // API key passed in header, never stored
  fastify.post(
    '/chat/stream',
    {
      schema: {
        description:
          'Proxy streaming chat requests to LLM providers. API key passed in X-LLM-Key header.',
        tags: ['LLM'],
        body: Type.Object({
          provider: Type.Union([
            Type.Literal('groq'),
            Type.Literal('openai'),
            Type.Literal('anthropic'),
          ]),
          model: Type.String(),
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            })
          ),
          system: Type.Optional(Type.String()),
          max_tokens: Type.Optional(Type.Number()),
        }),
        response: {
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const apiKeyHeader = request.headers['x-llm-key'];
      const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
      const { provider, model, messages, system, max_tokens = 512 } = request.body;

      if (!apiKey) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Missing X-LLM-Key header' },
        });
      }

      const endpoint = PROVIDER_ENDPOINTS[provider];
      if (!endpoint) {
        return reply.status(400).send({
          success: false,
          error: { message: `Unknown provider: ${provider}` },
        });
      }

      // Build provider-specific headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Build provider-specific body
      let body: Record<string, unknown>;

      if (provider === 'anthropic') {
        body = {
          model,
          system: system || 'You are a helpful assistant.',
          messages,
          max_tokens,
          stream: true,
        };
      } else if (provider === 'openai') {
        // OpenAI format - uses max_completion_tokens
        const allMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

        body = {
          model,
          messages: allMessages,
          max_completion_tokens: max_tokens,
          stream: true,
        };
      } else {
        // Groq format
        const allMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

        body = {
          model,
          messages: allMessages,
          max_tokens,
          temperature: 0.7,
          stream: true,
        };
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.error(`LLM proxy error: ${response.status} - ${errorText}`);
          // Try to parse error for better message
          let errorMessage = `Provider error: ${response.statusText}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
          } catch {
            // Use raw text if not JSON
            if (errorText) errorMessage = errorText;
          }
          return reply.status(response.status).send({
            success: false,
            error: { message: errorMessage },
          });
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Pipe the response stream directly to client
        if (response.body) {
          const reader = response.body.getReader();

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              reply.raw.end();
              return;
            }
            reply.raw.write(value);
            return pump();
          };

          await pump();
        } else {
          reply.raw.end();
        }
      } catch (err) {
        fastify.log.error({ err }, 'LLM proxy error');
        return reply.status(500).send({
          success: false,
          error: { message: 'Failed to proxy request to LLM provider' },
        });
      }
    }
  );

  // Demo endpoint - uses server-side Groq API key
  // Rate limited, fixed model, no user API key required
  fastify.post(
    '/demo/stream',
    {
      schema: {
        description:
          'Demo streaming endpoint using server-side Groq API key. Rate limited to 10 requests/minute per IP. Fixed to llama-3.1-8b-instant model.',
        tags: ['LLM'],
        body: Type.Object({
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            })
          ),
          system: Type.Optional(Type.String()),
        }),
        response: {
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
            }),
          }),
          429: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
              retryAfter: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // Get client IP for rate limiting
      const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
      const ip = Array.isArray(clientIp) ? (clientIp[0] ?? 'unknown') : String(clientIp);

      // Check rate limit using config values
      const demoLimit = fastify.config.DEMO_RATE_LIMIT;
      const demoWindow = fastify.config.DEMO_RATE_WINDOW;
      const rateLimit = checkDemoRateLimit(ip, demoLimit, demoWindow);
      if (!rateLimit.allowed) {
        return reply.status(429).send({
          success: false,
          error: {
            message: `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
            retryAfter: Math.ceil(rateLimit.resetIn / 1000),
          },
        });
      }

      // Add rate limit headers
      reply.header('X-RateLimit-Limit', demoLimit);
      reply.header('X-RateLimit-Remaining', rateLimit.remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000));

      // Get server-side Groq API key
      const apiKey = fastify.config.GROQ_API_KEY;
      if (!apiKey) {
        fastify.log.error('Demo endpoint: GROQ_API_KEY not configured');
        return reply.status(500).send({
          success: false,
          error: { message: 'Demo service temporarily unavailable' },
        });
      }

      let { messages, system } = request.body;

      // Security: Limit system prompt length
      if (system && system.length > DEMO_MAX_SYSTEM_PROMPT_LENGTH) {
        system = system.slice(0, DEMO_MAX_SYSTEM_PROMPT_LENGTH);
      }

      // Security: Limit number of messages, validate roles, and truncate content
      messages = messages
        .filter((m) => DEMO_ALLOWED_ROLES.includes(m.role))
        .slice(-DEMO_MAX_MESSAGES)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      // Build request body - always Groq format with fixed model
      const allMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

      const body = {
        model: DEMO_MODEL,
        messages: allMessages,
        max_tokens: DEMO_MAX_TOKENS,
        temperature: 0.7,
        stream: true,
      };

      try {
        const response = await fetch(PROVIDER_ENDPOINTS.groq!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.error(`Demo LLM error: ${response.status} - ${errorText}`);
          let errorMessage = 'Demo service error';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            // Keep generic error message
          }
          return reply.status(response.status).send({
            success: false,
            error: { message: errorMessage },
          });
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Pipe the response stream directly to client
        if (response.body) {
          const reader = response.body.getReader();

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              reply.raw.end();
              return;
            }
            reply.raw.write(value);
            return pump();
          };

          await pump();
        } else {
          reply.raw.end();
        }
      } catch (err) {
        fastify.log.error({ err }, 'Demo LLM error');
        return reply.status(500).send({
          success: false,
          error: { message: 'Demo service temporarily unavailable' },
        });
      }
    }
  );
};

export default llmRoutes;
