import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateInput } from './validate-input';
import type { DriftContext } from '../types';

// Mock prisma
vi.mock('@plugins/prisma', () => ({
  prisma: {
    conversation: {
      upsert: vi.fn().mockResolvedValue({ id: 'conv-123' }),
    },
  },
}));

function createContext(overrides: Partial<DriftContext> = {}): DriftContext {
  return {
    conversationId: 'conv-123',
    content: 'Hello world',
    role: 'user',
    reasonCodes: [],
    ...overrides,
  } as DriftContext;
}

describe('validateInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes with valid input', async () => {
    const ctx = createContext();
    const result = await validateInput(ctx);

    expect(result.reasonCodes).toContain('input_valid');
  });

  it('throws when conversationId is missing', async () => {
    const ctx = createContext({ conversationId: '' });

    await expect(validateInput(ctx)).rejects.toThrow('conversationId is required');
  });

  it('throws when conversationId is only whitespace', async () => {
    const ctx = createContext({ conversationId: '   ' });

    await expect(validateInput(ctx)).rejects.toThrow('conversationId is required');
  });

  it('throws when content is missing', async () => {
    const ctx = createContext({ content: '' });

    await expect(validateInput(ctx)).rejects.toThrow('content is required');
  });

  it('throws when content is only whitespace', async () => {
    const ctx = createContext({ content: '   ' });

    await expect(validateInput(ctx)).rejects.toThrow('content is required');
  });

  it('throws when role is invalid', async () => {
    const ctx = createContext({ role: 'admin' as any });

    await expect(validateInput(ctx)).rejects.toThrow('role must be "user" or "assistant"');
  });

  it('accepts user role', async () => {
    const ctx = createContext({ role: 'user' });
    const result = await validateInput(ctx);

    expect(result.reasonCodes).toContain('input_valid');
  });

  it('accepts assistant role', async () => {
    const ctx = createContext({ role: 'assistant' });
    const result = await validateInput(ctx);

    expect(result.reasonCodes).toContain('input_valid');
  });
});
