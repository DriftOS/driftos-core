import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

// Provider endpoints
const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
};

// eslint-disable-next-line @typescript-eslint/require-await
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
            const errorJson = JSON.parse(errorText) as {
              error?: { message?: string };
              message?: string;
            };
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
            const readResult = await reader.read();
            const done = readResult.done;
            const value = readResult.value as Uint8Array | undefined;
            if (done) {
              reply.raw.end();
              return;
            }
            reply.raw.write(value as Uint8Array);
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
};

export default llmRoutes;
