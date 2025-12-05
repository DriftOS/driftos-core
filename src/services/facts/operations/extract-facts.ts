import type { FactsContext, ExtractedFact } from '../types';
import { getConfig } from '@plugins/env';

const FACT_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'facts',
    schema: {
      type: 'object',
      properties: {
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
          },
        },
      },
      required: ['facts'],
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

  const prompt = `Extract key facts and decisions from this conversation.

For each fact:
- key: snake_case identifier (e.g., "destination", "budget", "hotel_choice")
- value: the factual value
- confidence: 0.0-1.0
- messageId: ID of the source message (shown in brackets)

Extract: decisions made, preferences stated, key information mentioned.

Conversation:
${conversationText}`;

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

  const facts: ExtractedFact[] = parsed.facts ?? [];

  ctx.extractedFacts = facts.filter((f) => f.confidence >= ctx.policy.minConfidence);
  ctx.reasonCodes.push(`extracted_${ctx.extractedFacts.length}_facts`);

  return ctx;
}
