import { CreateTodoOrchestrator } from './todo-orchestrator.js';
import type { CreateTodoInput, Todo } from './types/index.js';
import type { OrchestratorResult } from '@core/orchestration/index.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Todo Service - Example of Golden Standard architecture
 *
 * This service demonstrates:
 * - Pipeline-based orchestration
 * - Type safety throughout
 * - Automatic performance tracking
 * - Error handling
 * - Separation of concerns
 */
export class TodoService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new todo
   */
  public async createTodo(input: CreateTodoInput): Promise<OrchestratorResult<Todo>> {
    const orchestrator = new CreateTodoOrchestrator(this.prisma);
    return orchestrator.execute(input);
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: string; service: string }> {
    return {
      status: 'healthy',
      service: 'TodoService',
    };
  }
}
