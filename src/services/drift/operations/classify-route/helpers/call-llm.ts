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

const MODELS_WITH_JSON_SCHEMA: Record<string, string[]> = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.3-70b-specdec', 'llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: [], // Anthropic uses tool_use for structured output, not json_schema
};

const JSON_INSTRUCTION = `

IMPORTANT: You MUST respond with ONLY a valid JSON object in this exact format:
{"action": "STAY" | "ROUTE" | "BRANCH", "targetBranchId": string | null, "newBranchTopic": string | null, "reason": string, "confidence": number}

Do not include any other text, explanation, or markdown. Just the raw JSON object.`;

function getProviderConfig(config: ReturnType<typeof getConfig>) {
  const provider = config.LLM_PROVIDER?.toLowerCase() || 'groq';
  const model = config.LLM_MODEL;
  
  // Determine API key and endpoint based on provider
  let apiKey: string;
  let endpoint: string;
  let supportsJsonSchema: boolean;
  
  switch (provider) {
    case 'openai':
      apiKey = config.OPENAI_API_KEY || config.LLM_API_KEY;
      endpoint = 'https://api.openai.com/v1/chat/completions';
      supportsJsonSchema = (MODELS_WITH_JSON_SCHEMA.openai || []).some(m => model.includes(m));
      break;
    case 'anthropic':
      apiKey = config.ANTHROPIC_API_KEY || config.LLM_API_KEY;
      endpoint = 'https://api.anthropic.com/v1/messages';
      supportsJsonSchema = false; // Anthropic doesn't use json_schema format
      break;
    case 'groq':
    default:
      apiKey = config.GROQ_API_KEY || config.LLM_API_KEY;
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
      supportsJsonSchema = (MODELS_WITH_JSON_SCHEMA.groq || []).some(m => model.includes(m));
      break;
  }
  
  return { provider, apiKey, endpoint, supportsJsonSchema, model };
}

async function callOpenAICompatible(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>
): Promise<string> {
  const { apiKey, endpoint, supportsJsonSchema, model } = providerConfig;
  
  const finalPrompt = supportsJsonSchema ? prompt : prompt + JSON_INSTRUCTION;
  
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: finalPrompt }],
    temperature: 0.1,
    max_tokens: 200,
  };
  
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
  config: ReturnType<typeof getConfig>
): Promise<string> {
  const providerConfig = getProviderConfig(config);
  
  if (providerConfig.provider === 'anthropic') {
    return callAnthropic(prompt, providerConfig);
  }
  
  return callOpenAICompatible(prompt, providerConfig);
}
