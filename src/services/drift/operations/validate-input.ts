import type { DriftContext } from '../types';
import { prisma } from '@plugins/prisma';

/**
 * ValidateInput Operation
 *
 * Validates required input fields, ensures conversation exists with userId.
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

  // Validate userId is present (required for composite PK)
  if (!ctx.userId) {
    throw new Error('userId is required for authenticated requests');
  }

  // Ensure conversation exists with composite key (userId, conversationId)
  // This automatically enforces user isolation - users can't access other users' conversations
  const conversation = await prisma.conversation.findUnique({
    where: {
      userId_id: {
        userId: ctx.userId,
        id: ctx.conversationId,
      },
    },
    select: { id: true },
  });

  if (!conversation) {
    // Conversation doesn't exist - create it with user-scoped ID
    await prisma.conversation.create({
      data: {
        id: ctx.conversationId,
        userId: ctx.userId,
      },
    });
  }

  ctx.reasonCodes.push('input_valid');

  return ctx;
}
