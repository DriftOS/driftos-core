import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  processEphemeralConversation,
  type EphemeralState,
} from "@services/drift/ephemeral";
import { getModelConfig, getApiKey } from "@/config/llm-models";

// In-memory cache for conversation state (conversationId -> EphemeralState)
const conversationStateCache = new Map<string, EphemeralState>();

// Fact extraction prompt - extracts facts and semantic context
const FACT_EXTRACTION_PROMPT = `Analyze ONLY the messages below and extract key facts and context.
Return a JSON object with "branchContext" and "facts".

CRITICAL: Only extract facts that are EXPLICITLY stated in the messages below. DO NOT invent or hallucinate facts.

RULES:
1. branchContext: A one-sentence summary of what's being discussed (e.g., "discussing London house purchase including mortgage rates and school districts")
2. ONE fact per concept - consolidate multiple mentions
3. Use snake_case keys (e.g., "destination", "budget_range", "preference")
4. Confidence: 1.0 = explicit, 0.9 = stated once, 0.7 = implied
5. If no clear facts are stated, return an empty facts array

OUTPUT FORMAT:
{"branchContext": "one sentence describing the discussion", "facts": [{"key": "destination", "value": "Paris", "confidence": 0.9}]}

EXTRACT: Decisions, preferences, key entities (places, dates, amounts), constraints that are EXPLICITLY mentioned.
DO NOT extract: Questions without answers, trivial elements, facts not explicitly stated in the messages below.`;

interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
}

interface FactExtractionResult {
  branchContext: string; // Semantic context for routing
  facts: ExtractedFact[];
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

async function extractFactsFromBranch(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  modelBaseUrl: string,
  apiKey: string,
  supportsTemperature: boolean,
  defaultTemperature: number,
): Promise<{ result: FactExtractionResult; usage: TokenUsage }> {
  if (messages.length === 0) {
    return {
      result: { branchContext: "new conversation", facts: [] },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
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
      return {
        result: { branchContext: "general conversation", facts: [] },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = data.choices[0]?.message.content ?? "{}";

    let parsed: { branchContext?: string; facts?: unknown[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        result: { branchContext: "general conversation", facts: [] },
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    }

    return {
      result: {
        branchContext: parsed.branchContext || "general conversation",
        facts: (parsed.facts ?? []).map((f: any) => ({
          key: String(f.key || ""),
          value: String(f.value || ""),
          confidence: Number(f.confidence || 0.9),
        })),
      },
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  } catch (err) {
    console.error("Fact extraction error:", err);
    return {
      result: { branchContext: "general conversation", facts: [] },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
}

const DEMO_MAX_TOKENS = 256;
const DEMO_MAX_SYSTEM_PROMPT_LENGTH = 500;
const DEMO_MAX_MESSAGES = 20;
const DEMO_MAX_MESSAGE_LENGTH = 2000;
const DEMO_ALLOWED_ROLES = ["user", "assistant"];

// Rate limiting is handled by the gateway - backend services should not rate limit

const demoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  /**
   * /demo/route - Drift routing endpoint
   * Processes conversation through ephemeral drift, extracts facts, returns state
   * Returns JSON with token usage headers for cost tracking
   */
  fastify.post(
    "/route",
    {
      schema: {
        description:
          "Demo drift routing endpoint. Processes conversation history through drift routing. Returns routing decisions and branch state. Rate limited to 10 requests/minute per IP.",
        tags: ["Demo"],
        body: Type.Object({
          conversationId: Type.String(),
          messages: Type.Array(
            Type.Object({
              role: Type.String(),
              content: Type.String(),
            }),
          ),
          extractFacts: Type.Optional(Type.Boolean()), // Optional: extract facts during routing (default: false)
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              state: Type.Any(), // EphemeralState
              tokenUsage: Type.Object({
                inputTokens: Type.Number(),
                outputTokens: Type.Number(),
                totalTokens: Type.Number(),
              }),
              model: Type.String(),
              routingModel: Type.Optional(Type.String()),
              factExtractionModel: Type.Optional(Type.String()),
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
      // Rate limiting is handled by the gateway
      // Get demo model configuration
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

      const { conversationId, messages, extractFacts } = request.body;

      // Default to facts extraction enabled (driftos-core uses LLM routing with facts)
      const shouldExtractFacts = extractFacts ?? true;

      // Security: Sanitize messages (rate limiting handled by gateway)
      const sanitizedMessages = messages
        .filter((m) => DEMO_ALLOWED_ROLES.includes(m.role))
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      // Get previous state from cache if exists
      const previousState = conversationStateCache.get(conversationId);

      try {

        console.log(`\n[DEMO ROUTE] Received ${sanitizedMessages.length} messages, conversationId: ${conversationId}, extractFacts: ${shouldExtractFacts}`);
        console.log(`[DEMO ROUTE] Previous state exists: ${!!previousState}, lastProcessedIndex: ${previousState?.lastProcessedIndex ?? 0}`);
        console.log(`[DEMO ROUTE] Last 3 messages:`, sanitizedMessages.slice(-3).map(m => ({ role: m.role, content: m.content.slice(0, 50) })));

        // Process conversation incrementally (only new messages if state exists)
        // extractFacts flag controls whether facts are extracted during routing (default: false)
        const driftState = await processEphemeralConversation(
          sanitizedMessages,
          conversationId,
          previousState,
          shouldExtractFacts, // Pass extractFacts flag
        );

        // Cache the updated state
        conversationStateCache.set(conversationId, driftState);

        // Report only routing tokens from this request
        // Calculate tokens used in this request only (not cumulative)
        const previousRoutingTokens = previousState?.routingTokenUsage?.totalTokens ?? 0;
        const currentRoutingTokens = driftState.routingTokenUsage?.totalTokens ?? 0;
        const newRoutingTokens = currentRoutingTokens - previousRoutingTokens;

        // Estimate input/output split (roughly 75% input, 25% output based on typical routing)
        const newRoutingInputTokens = Math.floor(newRoutingTokens * 0.75);
        const newRoutingOutputTokens = newRoutingTokens - newRoutingInputTokens;

        // Log routing summary
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Routing tokens: ${newRoutingInputTokens} in / ${newRoutingOutputTokens} out`);

        reply.header("X-Token-Input", newRoutingInputTokens.toString());
        reply.header("X-Token-Output", newRoutingOutputTokens.toString());
        reply.header("X-Token-Total", newRoutingTokens.toString());
        reply.header("X-LLM-Model", driftState.routingModel || modelId);

        return reply.send({
          success: true,
          data: {
            state: driftState,
            tokenUsage: {
              inputTokens: newRoutingInputTokens,
              outputTokens: newRoutingOutputTokens,
              totalTokens: newRoutingTokens,
            },
            model: driftState.routingModel || modelId,
            routingModel: driftState.routingModel,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Demo route error");
        return reply.status(500).send({
          success: false,
          error: { message: "Demo service temporarily unavailable" },
        });
      }
    },
  );

  /**
   * /demo/stream - Simple LLM streaming (no routing)
   * Pure LLM response streaming without drift processing
   * For backward compatibility
   */
  fastify.post(
    "/stream",
    {
      schema: {
        description:
          "Demo streaming endpoint using server-side API key. Rate limited to 10 requests/minute per IP. Simple LLM streaming without drift routing.",
        tags: ["Demo"],
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
      // Rate limiting is handled by the gateway
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

      let { messages, system } = request.body;

      if (system && system.length > DEMO_MAX_SYSTEM_PROMPT_LENGTH) {
        system = system.slice(0, DEMO_MAX_SYSTEM_PROMPT_LENGTH);
      }

      messages = messages
        .filter((m) => DEMO_ALLOWED_ROLES.includes(m.role))
        .slice(-DEMO_MAX_MESSAGES)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      const allMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const body: Record<string, unknown> = {
        model: modelId,
        messages: allMessages,
        max_tokens: DEMO_MAX_TOKENS,
        stream: true,
      };

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

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

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

  /**
   * /demo/chat - LLM streaming with token tracking
   * Streams LLM response and includes token usage in final SSE event
   * Takes messages array, streams response, returns tokens in [TOKENS] event
   */
  fastify.post(
    "/chat",
    {
      schema: {
        description:
          "Demo chat streaming endpoint with token tracking. Streams LLM response and includes token usage in final SSE event. Rate limited to 10 requests/minute per IP.",
        tags: ["Demo"],
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
      // Rate limiting is handled by the gateway
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

      const { messages } = request.body;
      let { system } = request.body;

      if (system && system.length > DEMO_MAX_SYSTEM_PROMPT_LENGTH) {
        system = system.slice(0, DEMO_MAX_SYSTEM_PROMPT_LENGTH);
      }

      const sanitizedMessages = messages
        .filter((m) => DEMO_ALLOWED_ROLES.includes(m.role))
        .slice(-DEMO_MAX_MESSAGES)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, DEMO_MAX_MESSAGE_LENGTH),
        }));

      const llmMessages = system
        ? [{ role: "system", content: system }, ...sanitizedMessages]
        : sanitizedMessages;

      const body: Record<string, unknown> = {
        model: modelId,
        messages: llmMessages,
        max_tokens: DEMO_MAX_TOKENS,
        stream: true,
      };

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

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        if (response.body) {
          const reader = response.body.getReader();
          let inputTokens = 0;
          let outputTokens = 0;
          let totalTokens = 0;

          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            if (done) {
              // Send token usage as final SSE event
              reply.raw.write(
                `\n\ndata: [TOKENS]${JSON.stringify({
                  inputTokens,
                  outputTokens,
                  totalTokens,
                  model: modelId,
                })}\n\n`,
              );
              reply.raw.end();
              return;
            }

            // Parse SSE to extract usage data
            const text = new TextDecoder().decode(value);
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                try {
                  const json = JSON.parse(line.slice(6));
                  // Extract token usage if present
                  if (json.usage) {
                    inputTokens = json.usage.prompt_tokens || 0;
                    outputTokens = json.usage.completion_tokens || 0;
                    totalTokens = json.usage.total_tokens || 0;
                  }
                } catch {
                  // Not JSON or no usage, ignore
                }
              }
            }

            reply.raw.write(value);
            return pump();
          };

          await pump();
        } else {
          // No body - send empty tokens
          reply.raw.write(
            `data: [TOKENS]${JSON.stringify({
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              model: modelId,
            })}\n\n`,
          );
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

  /**
   * /demo/facts - Extract facts from conversation branches
   * Explicit fact extraction endpoint for on-demand semantic context updates
   * Allows client to control when facts are extracted (not automatic on routing)
   */
  fastify.post(
    "/facts",
    {
      schema: {
        description:
          "Extract facts from specific branches in a conversation. Used for on-demand semantic context updates. Rate limited to 10 requests/minute per IP.",
        tags: ["Demo"],
        body: Type.Object({
          conversationId: Type.String(),
          branchIds: Type.Optional(Type.Array(Type.String())), // Optional: specific branches, or all if omitted
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              branches: Type.Array(
                Type.Object({
                  id: Type.String(),
                  topic: Type.String(),
                  context: Type.Optional(Type.String()),
                  facts: Type.Array(Type.String()),
                  newMessagesProcessed: Type.Number(),
                })
              ),
              tokenUsage: Type.Object({
                inputTokens: Type.Number(),
                outputTokens: Type.Number(),
                totalTokens: Type.Number(),
              }),
              model: Type.String(),
            }),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
            }),
          }),
          404: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
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
      const { conversationId, branchIds } = request.body;

      // Get conversation state from cache
      const driftState = conversationStateCache.get(conversationId);

      if (!driftState) {
        return reply.status(404).send({
          success: false,
          error: { message: "Conversation not found. Use /demo/route first to create conversation state." },
        });
      }

      // Get demo model configuration for fact extraction
      const modelId = fastify.config.DEMO_MODEL;
      const modelConfig = getModelConfig(modelId);
      const apiKey = getApiKey(modelConfig.provider, fastify.config);

      try {
        // Determine which branches to process
        const branchesToProcess = branchIds
          ? driftState.branches.filter(b => branchIds.includes(b.id))
          : driftState.branches; // Process all branches if no specific IDs provided

        if (branchesToProcess.length === 0) {
          return reply.status(400).send({
            success: false,
            error: { message: "No valid branches found with provided IDs" },
          });
        }

        // Track token usage across all branch extractions
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalTokens = 0;

        // Extract facts from each branch
        const updatedBranchData = await Promise.all(
          branchesToProcess.map(async (branch) => {
            const branchMessages = driftState.messages
              .filter((m) => m.branchId === branch.id)
              .map((m) => ({ role: m.role, content: m.content }));

            // Only extract facts from NEW messages (incremental processing)
            const lastExtractionIndex = branch.lastFactExtractionIndex ?? 0;
            const newMessages = branchMessages.slice(lastExtractionIndex);

            // If no new messages, return existing branch data
            if (newMessages.length === 0) {
              return {
                id: branch.id,
                topic: branch.topic,
                context: branch.context,
                facts: branch.facts,
                newMessagesProcessed: 0,
              };
            }

            console.log(`[DEMO FACTS] Extracting facts from branch ${branch.id} (${newMessages.length} new messages)`);

            const { result: extraction, usage } = await extractFactsFromBranch(
              newMessages,
              modelId,
              modelConfig.baseUrl,
              apiKey,
              modelConfig.supportsTemperature ?? true,
              modelConfig.defaultTemperature ?? 0.3,
            );

            // Accumulate token usage
            totalInputTokens += usage.inputTokens;
            totalOutputTokens += usage.outputTokens;
            totalTokens += usage.totalTokens;

            // Update branch in cache
            const updatedBranch = {
              ...branch,
              topic: branch.topic, // Keep original topic
              context: extraction.branchContext,
              facts: [
                ...branch.facts,
                ...extraction.facts
                  .map((f) => `${f.key}: ${f.value}`)
                  .filter((newFact) => !branch.facts.includes(newFact))
              ],
              lastFactExtractionIndex: branchMessages.length,
            };

            // Update branch in cache
            const branchIndex = driftState.branches.findIndex(b => b.id === branch.id);
            if (branchIndex !== -1) {
              driftState.branches[branchIndex] = updatedBranch;
            }

            return {
              id: updatedBranch.id,
              topic: updatedBranch.topic,
              context: updatedBranch.context,
              facts: updatedBranch.facts,
              newMessagesProcessed: newMessages.length,
            };
          })
        );

        // Update cache with modified state
        conversationStateCache.set(conversationId, driftState);

        // Log fact extraction summary
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [DEMO FACTS] Extracted facts for ${branchesToProcess.length} branches | Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`);

        // Set token usage headers
        reply.header("X-Token-Input", totalInputTokens.toString());
        reply.header("X-Token-Output", totalOutputTokens.toString());
        reply.header("X-Token-Total", totalTokens.toString());
        reply.header("X-LLM-Model", modelId);

        return reply.send({
          success: true,
          data: {
            branches: updatedBranchData,
            tokenUsage: {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
              totalTokens: totalTokens,
            },
            model: modelId,
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Demo facts extraction error");
        return reply.status(500).send({
          success: false,
          error: { message: "Fact extraction service temporarily unavailable" },
        });
      }
    },
  );
};

export default demoRoutes;
