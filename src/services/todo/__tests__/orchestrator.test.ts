import { describe, it, expect, vi } from 'vitest';
import { CreateTodoOrchestrator } from '@services/todo/todo-orchestrator.js';
import type { CreateTodoInput } from '@services/todo/types/index.js';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  todo: {
    create: vi.fn().mockResolvedValue({
      id: 'test-id-123',
      title: 'Test Todo',
      description: 'Test Description',
      completed: false,
      userId: 'test-user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
} as unknown as PrismaClient;

describe('CreateTodoOrchestrator', () => {
  it('should create a todo successfully', async () => {
    const orchestrator = new CreateTodoOrchestrator(mockPrisma);
    const input: CreateTodoInput = {
      title: 'Test Todo',
      description: 'Test Description',
      userId: 'test-user-123',
    };

    const result = await orchestrator.execute(input);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe('Test Todo');
    expect(result.data?.description).toBe('Test Description');
    expect(result.data?.completed).toBe(false);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
  });

  it('should fail with validation errors for empty title', async () => {
    const orchestrator = new CreateTodoOrchestrator(mockPrisma);
    const input: CreateTodoInput = {
      title: '',
      description: 'Test Description',
      userId: 'test-user-123',
    };

    const result = await orchestrator.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('failed');
  });

  it('should track performance metrics', async () => {
    const orchestrator = new CreateTodoOrchestrator(mockPrisma);
    const input: CreateTodoInput = {
      title: 'Performance Test',
      description: 'Testing metrics',
      userId: 'test-user-123',
    };

    const result = await orchestrator.execute(input);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.['validate-input']).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.['create-todo']).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.['notify-creation']).toBeGreaterThanOrEqual(0);
  });
});
