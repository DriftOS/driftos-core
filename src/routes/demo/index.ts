import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { driftService } from '@services/drift';

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

function checkDemoRateLimit(
  ip: string,
  limit: number,
  window: number
): { allowed: boolean; remaining: number; resetIn: number } {
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

// eslint-disable-next-line @typescript-eslint/require-await
const demoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Demo endpoint - uses server-side Groq API key
  // Rate limited, fixed model, no user API key required
  fastify.post(
    '/stream',
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
      void reply.header('X-RateLimit-Limit', demoLimit);
      void reply.header('X-RateLimit-Remaining', rateLimit.remaining);
      void reply.header('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000));

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
        const groqEndpoint = PROVIDER_ENDPOINTS.groq;
        if (!groqEndpoint) {
          throw new Error('Groq endpoint not configured');
        }

        const response = await fetch(groqEndpoint, {
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
            const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
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
            const readResult = await reader.read();
            const done = readResult.done;
            const value = readResult.value as Uint8Array | undefined;
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

  // Demo chat endpoint - simplified version without full drift processing
  // Just returns basic action/branch info, no detailed NLP metadata
  fastify.post(
    '/chat',
    {
      schema: {
        description:
          'Demo chat endpoint with basic drift routing (LLM-based). Returns action, branch info, and streaming response. Rate limited to 10 requests/minute per IP. Note: This is a simplified demo without NLP metadata.',
        tags: ['LLM'],
        body: Type.Object({
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            })
          ),
          system: Type.Optional(Type.String()),
          extractFacts: Type.Optional(Type.Boolean()),
        }),
        response: {
          429: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
              retryAfter: Type.Number(),
            }),
          }),
          500: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // Get client IP for rate limiting
      const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
      const ip = Array.isArray(clientIp) ? (clientIp[0] ?? 'unknown') : String(clientIp);

      // Check rate limit
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

      void reply.header('X-RateLimit-Limit', demoLimit);
      void reply.header('X-RateLimit-Remaining', rateLimit.remaining);
      void reply.header('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000));

      const apiKey = fastify.config.GROQ_API_KEY;
      if (!apiKey) {
        fastify.log.error('Demo endpoint: GROQ_API_KEY not configured');
        return reply.status(500).send({
          success: false,
          error: { message: 'Demo service temporarily unavailable' },
        });
      }

      const { messages } = request.body;
      let { system } = request.body;

      // Security: Limit system prompt length
      if (system && system.length > DEMO_MAX_SYSTEM_PROMPT_LENGTH) {
        system = system.slice(0, DEMO_MAX_SYSTEM_PROMPT_LENGTH);
      }

      // Security: Limit and sanitize messages
      const sanitizedMessages = messages
        .filter((m) => DEMO_ALLOWED_ROLES.includes(m.role))
        .slice(-DEMO_MAX_MESSAGES)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      try {
        // Step 1: Create a temporary demo conversation
        const demoConversationId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const conversation = await fastify.prisma.conversation.create({
          data: {
            id: demoConversationId,
            userId: 'demo-user',
            topic: 'Demo Conversation',
          },
        });

        // Step 2: Process messages through drift orchestrator
        let currentBranchId: string | undefined;
        const processedMessages: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
          branchId: string;
          branchTopic: string;
          action: string;
        }> = [];

        for (const msg of sanitizedMessages) {
          const result = await driftService.route(conversation.id, msg.content, {
            role: msg.role,
            currentBranchId,
          });

          if (result.success && result.data) {
            currentBranchId = result.data.branchId;
            processedMessages.push({
              id: result.data.messageId,
              role: msg.role,
              content: msg.content,
              branchId: result.data.branchId,
              branchTopic: result.data.branchTopic || 'Unknown',
              action: result.data.action,
            });
          }
        }

        // Step 3: Build LLM request with conversation history
        const llmMessages = system
          ? [{ role: 'system', content: system }, ...sanitizedMessages]
          : sanitizedMessages;

        const body = {
          model: DEMO_MODEL,
          messages: llmMessages,
          max_tokens: DEMO_MAX_TOKENS,
          temperature: 0.7,
          stream: true,
        };

        const groqEndpoint2 = PROVIDER_ENDPOINTS.groq;
        if (!groqEndpoint2) {
          throw new Error('Groq endpoint not configured');
        }

        const response = await fetch(groqEndpoint2, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.error(`Demo chat LLM error: ${response.status} - ${errorText}`);

          // Cleanup demo conversation
          await fastify.prisma.conversation
            .delete({ where: { id: conversation.id } })
            .catch(() => {});

          let errorMessage = 'Demo service error';
          try {
            const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            // Keep generic error
          }
          return reply.status(500).send({
            success: false,
            error: { message: errorMessage },
          });
        }

        // Step 4: Stream response with state at the end
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        if (response.body) {
          const reader = response.body.getReader();
          let assistantContent = '';

          const pump = async (): Promise<void> => {
            const readResult = await reader.read();
            const done = readResult.done;
            const value = readResult.value as Uint8Array | undefined;
            if (done) {
              // Stream finished - process assistant response through drift
              if (assistantContent && currentBranchId) {
                const assistantResult = await driftService.route(
                  conversation.id,
                  assistantContent,
                  {
                    role: 'assistant',
                    currentBranchId,
                  }
                );

                if (assistantResult.success && assistantResult.data) {
                  processedMessages.push({
                    id: assistantResult.data.messageId,
                    role: 'assistant',
                    content: assistantContent,
                    branchId: assistantResult.data.branchId,
                    branchTopic: assistantResult.data.branchTopic || 'Unknown',
                    action: assistantResult.data.action,
                  });
                }
              }

              // Fetch branches from database
              const branches = await fastify.prisma.branch.findMany({
                where: { conversationId: conversation.id },
                include: {
                  _count: {
                    select: { messages: true, facts: true },
                  },
                },
                orderBy: { createdAt: 'asc' },
              });

              const finalState = {
                branches: branches.map((b) => ({
                  id: b.id,
                  topic: b.summary || 'Unknown',
                  parentId: b.parentId,
                  messageCount: b._count.messages,
                  facts: [], // Facts would need separate query, keeping empty for demo
                  createdAt: b.createdAt.getTime(),
                })),
                messages: processedMessages,
                currentBranchId: currentBranchId || branches[0]?.id || '',
                currentBranchTopic:
                  branches.find((b) => b.id === currentBranchId)?.summary || 'Unknown',
              };

              // Send state as final SSE event
              reply.raw.write(`\n\ndata: [STATE]${JSON.stringify(finalState)}\n\n`);
              reply.raw.end();

              // Cleanup demo conversation in background
              fastify.prisma.conversation
                .delete({ where: { id: conversation.id } })
                .catch((err: Error) =>
                  fastify.log.error({ err }, 'Failed to cleanup demo conversation')
                );

              return;
            }

            // Parse SSE to extract content for state tracking
            const text = new TextDecoder().decode(value as Uint8Array);
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const json = JSON.parse(line.slice(6)) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                  };
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) {
                    assistantContent += delta;
                  }
                } catch {
                  // Not JSON, ignore
                }
              }
            }

            const success = reply.raw.write(value as Uint8Array);
            if (!success) {
              fastify.log.warn('Write buffer full, backpressure applied');
            }
            return pump();
          };

          await pump();
        } else {
          // No body - cleanup and end
          await fastify.prisma.conversation
            .delete({ where: { id: conversation.id } })
            .catch(() => {});
          reply.raw.end();
        }
      } catch (err) {
        fastify.log.error({ err }, 'Demo chat error');
        return reply.status(500).send({
          success: false,
          error: { message: 'Demo service temporarily unavailable' },
        });
      }
    }
  );
};

export default demoRoutes;
