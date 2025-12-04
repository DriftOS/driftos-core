import type { TodoPipelineContext } from '../types/index.js';

export async function validateInput(context: TodoPipelineContext): Promise<TodoPipelineContext> {
  const errors: string[] = [];
  const input = context.input;

  if ('title' in input && !input.title?.trim()) {
    errors.push('Title is required');
  }

  if ('title' in input && input.title && input.title.length > 200) {
    errors.push('Title must be less than 200 characters');
  }

  if ('description' in input && input.description && input.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  if (!('userId' in input) || !input.userId) {
    errors.push('User ID is required');
  }

  if (errors.length > 0) {
    context.validationErrors = errors;
    context.errors.push(new Error(`Validation failed: ${errors.join(', ')}`));
  }

  return context;
}
