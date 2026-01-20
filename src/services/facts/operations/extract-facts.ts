import type { FactsContext, ExtractedFact } from '../types';
import { getConfig } from '@plugins/env';
import { getModelConfig, getApiKey } from '@/config/llm-models';
import { createLogger } from '@utils/logger';

const logger = createLogger('facts');

const FACT_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'facts_and_topic',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        branchTopic: {
          type: 'string',
          description: 'A concise 3-6 word topic name for this conversation branch',
        },
        facts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              confidence: { type: 'number' },
              messageId: { type: ['string', 'null'] },
            },
            required: ['key', 'value', 'confidence', 'messageId'],
            additionalProperties: false,
          },
        },
      },
      required: ['branchTopic', 'facts'],
      additionalProperties: false,
    },
  },
};

export async function extractFacts(ctx: FactsContext): Promise<FactsContext> {
  if (!ctx.messages || ctx.messages.length === 0) {
    ctx.extractedFacts = [];
    return ctx;
  }

  const config = getConfig();

  const conversationText = ctx.messages
    .map((m) => `[${m.id}] [${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const prompt = `Analyze this conversation branch and extract a topic name and key facts.

RULES:
1. branchTopic: A concise 3-6 word topic name (e.g., "Buying a house in London", "Planning dinner options", "Car repair advice")
2. ONE fact per concept - consolidate multiple mentions into a single fact
3. Use snake_case keys (e.g., "destination", "budget_range", "hotel_preference")
4. Confidence scoring:
   - 1.0 = explicitly stated in multiple messages
   - 0.9 = explicitly stated once
   - 0.7 = clearly implied
   - 0.5 = inferred
5. messageId: Include the message ID that mentions this fact, or null

EXTRACT:
- Decisions made
- Preferences stated
- Key entities (places, dates, people, amounts)
- Constraints or requirements

DO NOT extract:
- Questions without answers
- Trivial conversational elements

Conversation:
${conversationText}

OUTPUT FORMAT (respond with ONLY this JSON, no other text):
{
  "branchTopic": "3-6 word topic name",
  "facts": [
    {"key": "example_key", "value": "example value", "confidence": 0.9, "messageId": "msg_id_or_null"}
  ]
}`;

  const modelId = config.FACT_EXTRACTION_MODEL;
  const modelConfig = getModelConfig(modelId);
  const apiKey = getApiKey(modelConfig.provider, config);

  const body: Record<string, unknown> = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
  };

  // Only add temperature if model supports it
  if (modelConfig.supportsTemperature ?? true) {
    body.temperature = modelConfig.defaultTemperature ?? 0.2;
  }

  // Add response_format for models that support it
  if (modelConfig.provider !== 'anthropic') {
    if (modelConfig.supportsJsonSchema) {
      body.response_format = FACT_SCHEMA;
    } else {
      body.response_format = { type: 'json_object' };
    }
  }

  const response = await fetch(modelConfig.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, 'LLM API error');
    throw new Error(`LLM call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;

  logger.info({ branchId: ctx.branchId, parsed }, 'LLM response parsed');

  // Parse facts - handle both correct format and LLM's flat format
  const rawFacts = parsed.facts ?? [];
  const facts: ExtractedFact[] = rawFacts.map((f: any) => {
    // If fact has key/value, use as-is (correct format)
    if (f.key && f.value !== undefined) {
      return f;
    }

    // Otherwise, LLM returned flat format like {weather_condition: "cold", confidence: 0.9}
    // Extract the first property as the key/value pair
    const entries = Object.entries(f).filter(([k]) => k !== 'confidence' && k !== 'messageId');
    if (entries.length > 0) {
      const [key, value] = entries[0];
      return {
        key,
        value: String(value),
        confidence: f.confidence ?? 0.9,
        messageId: f.messageId ?? null,
      };
    }

    // Couldn't parse, skip this fact
    logger.warn({ fact: f }, 'Could not parse fact - skipping');
    return null;
  }).filter((f): f is ExtractedFact => f !== null);

  ctx.extractedFacts = facts.filter((f) => f.confidence >= ctx.policy.minConfidence);
  ctx.branchTopic = parsed.branchTopic;
  ctx.reasonCodes.push(`extracted_${ctx.extractedFacts.length}_facts`);

  logger.info(
    { branchId: ctx.branchId, branchTopic: ctx.branchTopic, factCount: ctx.extractedFacts.length },
    'Facts extracted'
  );

  if (ctx.branchTopic) {
    ctx.reasonCodes.push('topic_extracted');
  }

  return ctx;
}
