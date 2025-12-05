import type { DriftContext } from '../types';
import { prisma } from '@plugins/prisma';

/**
 * ValidateInput Operation
 *
 * Validates required input fields, ensures conversation exists.
 */
export async function validateInput(ctx: DriftContext): Promise<DriftContext> {
  if (!ctx.conversationId?.trim()) {
    throw new Error('conversationId is required');
  }

  if (!ctx.content?.trim()) {
    throw new Error('content is required');
  }

  if (ctx.role !== 'user' && ctx.role !== 'assistant') {
    throw new Error('role must be "user" or "assistant"');
  }

  // Ensure conversation exists
  await prisma.conversation.upsert({
    where: { id: ctx.conversationId },
    update: {},
    create: { id: ctx.conversationId },
  });

  ctx.reasonCodes.push('input_valid');

  return ctx;
}
