/**
 * LLM Model Configuration
 * Maps models to their capabilities and optimal settings
 */

import type { Env } from '@plugins/env';

export type ResponseFormatType = 'json_object' | 'json_schema';
export type Provider = 'groq' | 'openai' | 'anthropic';

export interface ModelConfig {
  id: string;
  provider: Provider;
  baseUrl: string;
  supportsJsonSchema: boolean;
  supportsTemperature?: boolean; // defaults to true
  defaultTemperature: number;
  maxTokens: number;
  description: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Groq - Fast inference
  'llama-3.1-8b-instant': {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: false,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: 'Fast, cheap. Good for simple extraction.',
  },
  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: false,
    defaultTemperature: 0.1,
    maxTokens: 2000,
    description: 'Balanced speed/quality. Better structured output.',
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: 'Optimized for tool use and structured output.',
  },
  'meta-llama/llama-4-maverick-17b-128e-instruct': {
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 2000,
    description: 'Larger context, better reasoning.',
  },

  // Anthropic - Claude 4.5 family (using aliases)
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    supportsJsonSchema: false,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: 'Fast, cheap. Great for structured extraction.',
  },
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    supportsJsonSchema: false,
    defaultTemperature: 0.1,
    maxTokens: 2000,
    description: 'Balanced speed/quality.',
  },
  'claude-opus-4-5': {
    id: 'claude-opus-4-5',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    supportsJsonSchema: false,
    defaultTemperature: 0.1,
    maxTokens: 4000,
    description: 'Best quality. Use for complex reasoning.',
  },

  // OpenAI - GPT-5 family (no temperature control)
  'gpt-5-nano': {
    id: 'gpt-5-nano',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsJsonSchema: true,
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 1000,
    description: 'Fastest, cheapest GPT-5. Great for extraction.',
  },
  'gpt-5-mini': {
    id: 'gpt-5-mini',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsJsonSchema: true,
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 1000,
    description: 'Balanced GPT-5 variant.',
  },
  'gpt-5': {
    id: 'gpt-5',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsJsonSchema: true,
    supportsTemperature: false,
    defaultTemperature: 1,
    maxTokens: 2000,
    description: 'Full GPT-5. Best for complex reasoning.',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: 'Fast, cheap. Good structured output.',
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 2000,
    description: 'Best OpenAI model. Excellent structured output.',
  },
  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: 'GPT OSS 20B via Groq. Good for structured output.',
  },
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    supportsJsonSchema: true,
    defaultTemperature: 0.1,
    maxTokens: 2000,
    description: 'GPT OSS 120B via Groq. Better reasoning and structured output.',
  },
};

/**
 * Get model config with fallback to defaults
 */
export function getModelConfig(modelId: string): ModelConfig {
  if (MODEL_CONFIGS[modelId]) {
    return MODEL_CONFIGS[modelId];
  }

  // Dynamic fallback based on model name patterns
  let provider: Provider = 'groq';
  let baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
  let supportsJsonSchema = false;

  // Detect provider from model name
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.includes('openai/')) {
    provider = 'openai';
    baseUrl = 'https://api.openai.com/v1/chat/completions';
    supportsJsonSchema = true;
  } else if (modelId.startsWith('claude-')) {
    provider = 'anthropic';
    baseUrl = 'https://api.anthropic.com/v1/messages';
    supportsJsonSchema = false;
  } else if (modelId.includes('llama') || modelId.includes('meta-')) {
    provider = 'groq';
    baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    supportsJsonSchema = true; // Most recent models support it
  }

  return {
    id: modelId,
    provider,
    baseUrl,
    supportsJsonSchema,
    defaultTemperature: 0.1,
    maxTokens: 1000,
    description: `Unknown model - inferred ${provider} provider`,
  };
}

/**
 * Get the API key for a provider from env config
 */
export function getApiKey(provider: Provider, env: Env): string {
  const keyMap: Record<Provider, string> = {
    groq: env.GROQ_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
  };

  const key = keyMap[provider];
  if (!key) {
    throw new Error(
      `No API key configured for provider: ${provider}. Set ${provider.toUpperCase()}_API_KEY in .env`
    );
  }
  return key;
}

/**
 * Get the appropriate response_format for a model (OpenAI-compatible APIs only)
 */
export function getResponseFormat(
  modelId: string,
  schema?: object
): { type: string; json_schema?: object } | undefined {
  const config = getModelConfig(modelId);

  // Anthropic doesn't use response_format
  if (config.provider === 'anthropic') {
    return undefined;
  }

  if (config.supportsJsonSchema && schema) {
    return {
      type: 'json_schema',
      json_schema: schema,
    };
  }

  return { type: 'json_object' };
}
