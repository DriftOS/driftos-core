import type { DriftContext } from '../types';
import { prisma } from '@plugins/prisma';

/**
 * LoadRecentMessages Operation
 *
 * Loads recent messages from current branch for routing context
 */
export async function loadRecentMessages(ctx: DriftContext): Promise<DriftContext> {
  // Skip if no current branch
  if (!ctx.currentBranch) {
    ctx.reasonCodes.push('no_branch_for_messages');
    return ctx;
  }

  // Load last 5 messages from current branch (user messages only for context)
  const messages = await prisma.message.findMany({
    where: {
      branchId: ctx.currentBranch.id,
      role: 'user',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      role: true,
      content: true,
    },
  });

  // Store in reverse order (oldest first)
  ctx.recentMessages = messages.reverse();
  ctx.reasonCodes.push('recent_messages_loaded');

  return ctx;
}
