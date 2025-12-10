import type { FactsContext, ExtractedFact } from '../types';
import { getConfig } from '@plugins/env';
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
            required: ['key', 'value', 'confidence'],
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
    {"key": "destination", "value": "Paris", "confidence": 0.9, "messageId": "abc123"}
  ]
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: FACT_SCHEMA,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM call failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;

  logger.info({ branchId: ctx.branchId, parsed }, 'LLM response parsed');

  const facts: ExtractedFact[] = parsed.facts ?? [];

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
