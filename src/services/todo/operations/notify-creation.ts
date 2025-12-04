import type { TodoPipelineContext } from '../types/index.js';

export async function notifyCreation(context: TodoPipelineContext): Promise<TodoPipelineContext> {
  // Skip if no todo was created
  if (!context.todo) {
    return context;
  }

  // Simulate notification (could be email, webhook, etc.)
  // In production, this might send to a message queue
  context.results.notificationSent = {
    type: 'todo.created',
    todoId: context.todo.id,
    userId: context.todo.userId,
    timestamp: new Date().toISOString(),
  };

  // Log for demo purposes
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Notification] Todo created: ${context.todo.title}`);
  }

  return context;
}
