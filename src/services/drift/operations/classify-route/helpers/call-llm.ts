import Groq from 'groq-sdk';
import { z } from 'zod';
import { getConfig } from '@/plugins/env';
import { getModelConfig, getApiKey } from '@/config/llm-models';

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
}

// Decision discriminated union (shared by both schemas)
const decisionUnion = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('STAY'),
    targetBranchId: z.null(),
    newBranchTopic: z.null(),
    reason: z.string(),
    confidence: z.number(),
  }),
  z.object({
    action: z.literal('ROUTE'),
    targetBranchId: z.string(),
    newBranchTopic: z.null(),
    reason: z.string(),
    confidence: z.number(),
  }),
  z.object({
    action: z.literal('BRANCH'),
    targetBranchId: z.null(),
    newBranchTopic: z.string(),
    reason: z.string(),
    confidence: z.number(),
  }),
]);

// Fact object structure (shared)
// Note: All fields are REQUIRED for Groq strict mode (use empty array [] for no supersedes)
// Note: isUpdate BEFORE values - makes LLM less likely to nest it inside values
const factObjectSchema = z.object({
  key: z.string(),
  isUpdate: z.boolean(), // true if this fact KEY exists in branch already - MUST be at fact level
  values: z.array(z.object({
    value: z.string(),
    confidence: z.number(),
    supersedes: z.array(z.string()), // REQUIRED array - use [] if no supersession
  })),
});

// ROUTING-ONLY SCHEMA (no facts) for Groq
const routeDecisionOnlySchemaGroq = z.object({
  decision: decisionUnion,
});

// ROUTING-ONLY SCHEMA (no facts) for OpenAI
const routeDecisionOnlySchemaOpenAI = z.object({
  decision: decisionUnion,
});

// ROUTING + FACTS SCHEMA for Groq (all fields REQUIRED)
const routeDecisionWithFactsSchemaGroq = z.object({
  decision: decisionUnion,
  branchContext: z.string(), // REQUIRED - use "" if no context
  facts: z.array(factObjectSchema), // REQUIRED - use [] if no facts
});

// ROUTING + FACTS SCHEMA for OpenAI (facts optional)
const routeDecisionWithFactsSchemaOpenAI = z.object({
  decision: decisionUnion,
  branchContext: z.string().optional(),
  facts: z.array(factObjectSchema).optional(),
});

export type RouteDecision = z.infer<typeof routeDecisionWithFactsSchemaGroq>['decision'];

// Semantic instructions for GROQ models (schema enforces structure via constrained decoding)
const JSON_INSTRUCTION_GROQ = `

ROUTING:
- STAY: Message continues current topic
- ROUTE: Message switches to existing topic (use topic number)
- BRANCH: Message starts NEW topic (3-6 word name)

FACTS:
- branchContext: One sentence summary of what's being discussed
- Extract ONLY important facts: decisions, preferences, places/dates/amounts, constraints
- Use snake_case keys
- isUpdate: true if fact key exists in [Facts: ...], false for new
- Confidence: 1.0=definitive, 0.9=clear, 0.7=implied
- supersedes: Only for REPLACEMENTS not additions`;

// Semantic instructions for OPENAI models (schema enforces structure via constrained decoding)
const JSON_INSTRUCTION_OPENAI = `

ROUTING:
- STAY: Message continues current topic
- ROUTE: Message switches to existing topic (use topic number)
- BRANCH: Message starts NEW topic (3-6 word name)

FACTS (optional):
- branchContext: One sentence summary
- Extract ONLY important facts: decisions, preferences, places/dates/amounts, constraints
- Use snake_case keys
- isUpdate: true if fact key exists in [Facts: ...], false for new
- Confidence: 1.0=definitive, 0.9=clear, 0.7=implied
- supersedes: Only for REPLACEMENTS not additions`;

function getProviderConfig(
  config: ReturnType<typeof getConfig>,
  modelOverride?: string,
  _providerOverride?: string
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

async function callGroq(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>,
  extractFacts: boolean
): Promise<LLMResponse> {
  const { apiKey, supportsJsonSchema, supportsTemperature, defaultTemperature, model } = providerConfig;

  const groq = new Groq({ apiKey });

  // Use appropriate instruction based on whether facts are being extracted
  const instruction = extractFacts ? JSON_INSTRUCTION_GROQ : '';
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'user', content: supportsJsonSchema ? prompt : prompt + instruction }
  ];

  const requestParams: any = {
    model,
    messages,
    max_tokens: extractFacts ? 1000 : 500, // Less tokens needed for routing-only
  };

  // Only add temperature if model supports it
  if (supportsTemperature) {
    requestParams.temperature = defaultTemperature ?? 0.1;
  }

  // Add strict JSON schema if supported, otherwise use json_object mode
  if (supportsJsonSchema) {
    // Use routing-only or routing+facts schema based on flag
    const schema = extractFacts
      ? routeDecisionWithFactsSchemaGroq.toJSONSchema()
      : routeDecisionOnlySchemaGroq.toJSONSchema();

    requestParams.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'route_decision',
        strict: true,
        schema,
      },
    };
  } else {
    // Fallback to json_object mode for models without schema support
    requestParams.response_format = { type: 'json_object' };
  }

  const response = await groq.chat.completions.create(requestParams);

  const content = response.choices[0]?.message?.content || '{}';

  return {
    content,
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    },
    model,
  };
}

async function callAnthropic(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>,
  extractFacts: boolean
): Promise<LLMResponse> {
  const { apiKey, model } = providerConfig;

  // Only add fact extraction instructions if enabled
  const instruction = extractFacts ? JSON_INSTRUCTION_OPENAI : '';
  const finalPrompt = prompt + instruction;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: extractFacts ? 1000 : 500, // Less tokens for routing-only
      messages: [{ role: 'user', content: finalPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM call failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  return {
    content: data.content[0].text,
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    model,
  };
}

async function callOpenAI(
  prompt: string,
  providerConfig: ReturnType<typeof getProviderConfig>,
  extractFacts: boolean
): Promise<LLMResponse> {
  const { apiKey, endpoint, supportsTemperature, defaultTemperature, model } = providerConfig;

  // Only add fact extraction instructions if enabled
  const instruction = extractFacts ? JSON_INSTRUCTION_OPENAI : '';
  const finalPrompt = prompt + instruction;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: finalPrompt }],
    max_tokens: extractFacts ? 1000 : 500, // Less tokens for routing-only
  };

  // Only add temperature if model supports it
  if (supportsTemperature) {
    body.temperature = defaultTemperature ?? 0.1;
  }

  // Use routing-only or routing+facts schema based on flag
  const schema = extractFacts
    ? routeDecisionWithFactsSchemaOpenAI.toJSONSchema()
    : routeDecisionOnlySchemaOpenAI.toJSONSchema();

  body.response_format = {
    type: 'json_schema',
    json_schema: {
      name: 'route_decision',
      strict: true,
      schema,
    },
  };

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

  const data = await response.json() as any;
  return {
    content: data.choices[0].message.content,
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
    model,
  };
}

export async function callLLM(
  prompt: string,
  config: ReturnType<typeof getConfig>,
  extractFacts: boolean = false, // Default to routing-only
  modelOverride?: string,
  providerOverride?: string
): Promise<LLMResponse> {
  const providerConfig = getProviderConfig(config, modelOverride, providerOverride);

  if (providerConfig.provider === 'anthropic') {
    return callAnthropic(prompt, providerConfig, extractFacts);
  }

  if (providerConfig.provider === 'groq') {
    return callGroq(prompt, providerConfig, extractFacts);
  }

  if (providerConfig.provider === 'openai') {
    return callOpenAI(prompt, providerConfig, extractFacts);
  }

  throw new Error(`Unsupported provider: ${providerConfig.provider}`);
}
