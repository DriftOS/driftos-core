import { getConfig } from '@/plugins/env';
import { getModelConfig, getApiKey, getResponseFormat } from '@/config/llm-models';

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

const JSON_INSTRUCTION = `

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact format:
{"action": "STAY" | "ROUTE" | "BRANCH", "targetBranchId": string | null, "newBranchTopic": string | null, "reason": string, "confidence": number}

Do not include any other text, explanation, or markdown. Just the raw JSON object.`;

function getProviderConfig(
  config: ReturnType<typeof getConfig>,
  modelOverride?: string,
  providerOverride?: string
) {
  // Use override if provided, otherwise use env config
  const modelId = modelOverride || config.DRIFT_ROUTING_MODEL;
  const modelConfig = getModelConfig(modelId);
  const apiKey = getApiKey(modelConfig.provider, config);

  return {
    provider: modelConfig.provider,
    apiKey,
    endpoint: modelConfig.baseUrl,
    supportsJsonSchema: modelConfig.supportsJsonSchema,
    supportsTemperature: modelConfig.supportsTemperature ?? true,
    defaultTemperature: modelConfig.defaultTemperature,
    model: modelId,
  };
}

async function callOpenAICompatible(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>
): Promise<string> {
  const { apiKey, endpoint, supportsJsonSchema, supportsTemperature, defaultTemperature, model } =
    providerConfig;

  const finalPrompt = supportsJsonSchema ? prompt : prompt + JSON_INSTRUCTION;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: finalPrompt }],
    max_tokens: 200,
  };

  // Only add temperature if model supports it
  if (supportsTemperature) {
    body.temperature = defaultTemperature ?? 0.1;
  }

  if (supportsJsonSchema) {
    body.response_format = ROUTE_SCHEMA;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>
): Promise<string> {
  const { apiKey, model } = providerConfig;

  const finalPrompt = prompt + JSON_INSTRUCTION;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [{ role: 'user', content: finalPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function callLLM(
  prompt: string,
  config: ReturnType<typeof getConfig>,
  modelOverride?: string,
  providerOverride?: string
): Promise<string> {
  const providerConfig = getProviderConfig(config, modelOverride, providerOverride);

  if (providerConfig.provider === 'anthropic') {
    return callAnthropic(prompt, providerConfig);
  }

  return callOpenAICompatible(prompt, providerConfig);
}
