import type { OperationContext } from '@core/orchestration/index.js';
import type { PrismaClient } from '@prisma/client';

// Todo type matches Prisma schema
export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoInput {
  title: string;
  description: string;
  userId: string;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
  userId: string;
}

export interface TodoPipelineContext extends OperationContext {
  input: CreateTodoInput | UpdateTodoInput;
  prisma: PrismaClient;
  todo?: Todo;
  todos?: Todo[];
  validationErrors?: string[];
}
