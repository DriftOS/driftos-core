import { getConfig } from '@/plugins/env';

const ROUTE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'route_decision',
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['STAY', 'ROUTE', 'BRANCH'] },
        targetBranchId: { type: ['string', 'null'] },
        newBranchTopic: { type: ['string', 'null'] },
        reason: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['action', 'reason', 'confidence'],
    },
  },
};

export async function callLLM(
  prompt: string,
  config: ReturnType<typeof getConfig>
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 150,
      response_format: ROUTE_SCHEMA,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM call failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
