import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  processEphemeralConversation,
  type EphemeralState,
} from "@services/drift/ephemeral";
import { getModelConfig, getApiKey } from "@/config/llm-models";

// Fact extraction prompt - same as full version
const FACT_EXTRACTION_PROMPT = `Analyze ONLY the messages below and extract key facts.
Return a JSON object with "branchTopic" and "facts".

CRITICAL: Only extract facts that are EXPLICITLY stated in the messages below. Do NOT invent or hallucinate facts.

RULES:
1. branchTopic: A concise 3-6 word topic name based ONLY on what's discussed below
2. ONE fact per concept - consolidate multiple mentions
3. Use snake_case keys (e.g., "destination", "budget_range", "preference")
4. Confidence: 1.0 = explicit, 0.9 = stated once, 0.7 = implied
5. If no clear facts are stated, return an empty facts array

OUTPUT FORMAT:
{"branchTopic": "topic name", "facts": [{"key": "destination", "value": "Paris", "confidence": 0.9}]}

EXTRACT: Decisions, preferences, key entities (places, dates, amounts), constraints that are EXPLICITLY mentioned.
DO NOT extract: Questions without answers, trivial elements, facts not explicitly stated in the messages below.`;

interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
}

interface FactExtractionResult {
  branchTopic: string;
  facts: ExtractedFact[];
}

async function extractFactsFromBranch(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  modelBaseUrl: string,
  apiKey: string,
  supportsTemperature: boolean,
  defaultTemperature: number,
): Promise<FactExtractionResult> {
  if (messages.length === 0) {
    return { branchTopic: "New conversation", facts: [] };
  }

  const conversationText = messages
    .map((m, i) => `[msg-${i + 1}] [${m.role.toUpperCase()}]: ${m.content}`)
    .join("\n\n");

  const prompt = `${FACT_EXTRACTION_PROMPT}\n\nConversation:\n${conversationText}\n\nOutput JSON:`;

  try {
    const body: Record<string, unknown> = {
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      response_format: { type: "json_object" },
    };

    if (supportsTemperature) {
      body.temperature = defaultTemperature ?? 0.3;
    }

    const response = await fetch(modelBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Fact extraction failed:", response.status);
      return { branchTopic: "Conversation", facts: [] };
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message.content ?? "{}";

    let parsed: { branchTopic?: string; facts?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { branchTopic: "Conversation", facts: [] };
    }

    return {
      branchTopic: parsed.branchTopic || "Conversation",
      facts: (parsed.facts ?? []).map((f: any) => ({
        key: String(f.key || ""),
        value: String(f.value || ""),
        confidence: Number(f.confidence || 0.9),
      })),
    };
  } catch (err) {
    console.error("Fact extraction error:", err);
    return { branchTopic: "Conversation", facts: [] };
  }
}
const DEMO_MAX_TOKENS = 256;
const DEMO_MAX_SYSTEM_PROMPT_LENGTH = 500;
const DEMO_MAX_MESSAGES = 20;
const DEMO_MAX_MESSAGE_LENGTH = 2000; // per message content limit
const DEMO_ALLOWED_ROLES = ["user", "assistant"]; // prevent system role injection

// Simple in-memory rate limiter for demo endpoint
const demoRateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkDemoRateLimit(
  ip: string,
  limit: number,
  window: number,
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

const demoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Demo endpoint - uses server-side Groq API key
  // Rate limited, fixed model, no user API key required
  fastify.post(
    "/stream",
    {
      schema: {
        description:
          "Demo streaming endpoint using server-side Groq API key. Rate limited to 10 requests/minute per IP. Fixed to llama-3.1-8b-instant model.",
        tags: ["LLM"],
        body: Type.Object({
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            }),
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
      const clientIp =
        request.ip || request.headers["x-forwarded-for"] || "unknown";
      const ip = Array.isArray(clientIp)
        ? (clientIp[0] ?? "unknown")
        : String(clientIp);

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
      reply.header("X-RateLimit-Limit", demoLimit);
      reply.header("X-RateLimit-Remaining", rateLimit.remaining);
      reply.header("X-RateLimit-Reset", Math.ceil(rateLimit.resetIn / 1000));

      // Get demo model configuration
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

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

      // Build request body with model-specific configuration
      const allMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const body: Record<string, unknown> = {
        model: modelId,
        messages: allMessages,
        max_tokens: DEMO_MAX_TOKENS,
        stream: true,
      };

      // Only add temperature if model supports it
      if (modelConfig.supportsTemperature ?? true) {
        body.temperature = modelConfig.defaultTemperature ?? 0.7;
      }

      try {
        const response = await fetch(modelConfig.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.error(
            `Demo LLM error: ${response.status} - ${errorText}`,
          );
          let errorMessage = "Demo service error";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            // Keep generic error message
          }
          return reply.status(response.status as 500).send({
            success: false,
            error: { message: errorMessage },
          });
        }

        // Set SSE headers
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
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
        fastify.log.error({ err }, "Demo LLM error");
        return reply.status(500).send({
          success: false,
          error: { message: "Demo service temporarily unavailable" },
        });
      }
    },
  );

  // Demo chat endpoint - processes conversation through drift, streams LLM, returns state
  // This is the full demo experience with branching, routing, and fact extraction
  fastify.post(
    "/chat",
    {
      schema: {
        description:
          "Demo chat endpoint with full drift processing. Processes conversation history through drift routing, streams LLM response, and returns complete state (branches, facts, routing decisions). Rate limited to 10 requests/minute per IP.",
        tags: ["LLM"],
        body: Type.Object({
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            }),
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
      const clientIp =
        request.ip || request.headers["x-forwarded-for"] || "unknown";
      const ip = Array.isArray(clientIp)
        ? (clientIp[0] ?? "unknown")
        : String(clientIp);

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

      reply.header("X-RateLimit-Limit", demoLimit);
      reply.header("X-RateLimit-Remaining", rateLimit.remaining);
      reply.header("X-RateLimit-Reset", Math.ceil(rateLimit.resetIn / 1000));

      // Get demo model configuration
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

      const { messages, extractFacts } = request.body;
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
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      try {
        // Step 1: Process conversation through ephemeral drift
        // This builds up branches, routing decisions, and extracts facts - all in memory
        const driftState = await processEphemeralConversation(
          sanitizedMessages,
          {
            extractFacts: extractFacts ?? true,
          },
        );

        // Step 2: Build LLM request with conversation history
        const llmMessages = system
          ? [{ role: "system", content: system }, ...sanitizedMessages]
          : sanitizedMessages;

        const body: Record<string, unknown> = {
          model: modelId,
          messages: llmMessages,
          max_tokens: DEMO_MAX_TOKENS,
          stream: true,
        };

        // Only add temperature if model supports it
        if (modelConfig.supportsTemperature ?? true) {
          body.temperature = modelConfig.defaultTemperature ?? 0.7;
        }

        const response = await fetch(modelConfig.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          fastify.log.error(
            `Demo chat LLM error: ${response.status} - ${errorText}`,
          );
          let errorMessage = "Demo service error";
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch {
            // Keep generic error
          }
          return reply.status(500).send({
            success: false,
            error: { message: errorMessage },
          });
        }

        // Step 3: Stream response with state at the end
        // We use a custom SSE format:
        // - Regular SSE chunks for LLM streaming
        // - Final "data: [STATE]" event with the drift state JSON
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        if (response.body) {
          const reader = response.body.getReader();
          let assistantContent = "";

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              // Stream finished - now send the state
              // Add the assistant message to the drift state
              const updatedMessages = [
                ...driftState.messages,
                {
                  id: `msg-${driftState.messages.length + 1}`,
                  role: "assistant" as const,
                  content: assistantContent,
                  branchId: driftState.currentBranchId,
                  branchTopic: driftState.currentBranchTopic,
                  action: "STAY" as const,
                  driftAction: "STAY" as const,
                },
              ];

              // Extract facts from each branch using LLM
              const updatedBranches = await Promise.all(
                driftState.branches.map(async (branch) => {
                  const branchMessages = updatedMessages
                    .filter((m) => m.branchId === branch.id)
                    .map((m) => ({ role: m.role, content: m.content }));

                  if (branchMessages.length === 0) {
                    return branch;
                  }

                  const extraction = await extractFactsFromBranch(
                    branchMessages,
                    modelId,
                    modelConfig.baseUrl,
                    apiKey,
                    modelConfig.supportsTemperature ?? true,
                    modelConfig.defaultTemperature ?? 0.3,
                  );

                  return {
                    ...branch,
                    topic: extraction.branchTopic || branch.topic,
                    facts: extraction.facts.map((f) => `${f.key}: ${f.value}`),
                  };
                }),
              );

              const finalState: EphemeralState = {
                ...driftState,
                branches: updatedBranches,
                messages: updatedMessages,
                currentBranchTopic:
                  updatedBranches.find(
                    (b) => b.id === driftState.currentBranchId,
                  )?.topic || driftState.currentBranchTopic,
              };

              // Send state as final SSE event
              reply.raw.write(
                `\n\ndata: [STATE]${JSON.stringify(finalState)}\n\n`,
              );
              reply.raw.end();
              return;
            }

            // Parse SSE to extract content for state tracking
            const text = new TextDecoder().decode(value);
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                  const json = JSON.parse(line.slice(6));
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) {
                    assistantContent += delta;
                  }
                } catch {
                  // Not JSON, ignore
                }
              }
            }

            reply.raw.write(value);
            return pump();
          };

          await pump();
        } else {
          // No body - just send state
          const finalState: EphemeralState = {
            ...driftState,
            messages: [
              ...driftState.messages,
              {
                id: `msg-${driftState.messages.length + 1}`,
                role: "assistant",
                content: "",
                branchId: driftState.currentBranchId,
                branchTopic: driftState.currentBranchTopic,
                action: "STAY",
                driftAction: "STAY",
              },
            ],
          };
          reply.raw.write(`data: [STATE]${JSON.stringify(finalState)}\n\n`);
          reply.raw.end();
        }
      } catch (err) {
        fastify.log.error({ err }, "Demo chat error");
        return reply.status(500).send({
          success: false,
          error: { message: "Demo service temporarily unavailable" },
        });
      }
    },
  );
};

export default demoRoutes;
