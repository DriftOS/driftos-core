import { BaseOrchestrator, DefaultPerformanceTracker } from '@core/orchestration/index.js';
import type { PipelineStage } from '@core/orchestration/index.js';
import type { TodoPipelineContext, CreateTodoInput, Todo } from './types/index.js';
import type { PrismaClient } from '@prisma/client';
import { validateInput } from './operations/validate-input.js';
import { createTodo } from './operations/create-todo.js';
import { notifyCreation } from './operations/notify-creation.js';

export class CreateTodoOrchestrator extends BaseOrchestrator<
  TodoPipelineContext,
  Todo,
  CreateTodoInput
> {
  constructor(private prisma: PrismaClient) {
    super({
      name: 'CreateTodoOrchestrator',
      timeout: 5000,
      enableMetrics: true,
      logErrors: true,
    });
  }

  protected async initializeContext(input: CreateTodoInput): Promise<TodoPipelineContext> {
    return {
      requestId: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      perfTracker: new DefaultPerformanceTracker(),
      prisma: this.prisma,
      input,
      results: {},
      errors: [],
      metadata: {
        orchestrator: this.getName(),
        inputType: 'CreateTodoInput',
      },
    };
  }

  protected getPipeline(): PipelineStage<TodoPipelineContext>[] {
    return [
      {
        name: 'validate-input',
        operation: validateInput,
        critical: true,
        timeout: 1000,
      },
      {
        name: 'create-todo',
        operation: createTodo,
        critical: true,
        timeout: 2000,
      },
      {
        name: 'notify-creation',
        operation: notifyCreation,
        critical: false, // Non-critical - don't fail if notification fails
        timeout: 1000,
      },
    ];
  }

  protected buildResult(context: TodoPipelineContext): Todo {
    if (!context.todo) {
      throw new Error('Todo creation failed - no todo in context');
    }
    return context.todo;
  }
}
