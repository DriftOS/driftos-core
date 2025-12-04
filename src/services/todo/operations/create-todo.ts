import type { TodoPipelineContext } from '../types/index.js';
import type { CreateTodoInput } from '../types/index.js';

export async function createTodo(context: TodoPipelineContext): Promise<TodoPipelineContext> {
  // Skip if validation failed
  if (context.validationErrors && context.validationErrors.length > 0) {
    return context;
  }

  const input = context.input as CreateTodoInput;

  try {
    // Create todo in database using Prisma
    const todo = await context.prisma.todo.create({
      data: {
        title: input.title,
        description: input.description || null,
        userId: input.userId,
        completed: false,
      },
    });

    context.todo = todo;
    context.results.createdTodo = todo;
  } catch (error) {
    context.errors.push(error as Error);
  }

  return context;
}
