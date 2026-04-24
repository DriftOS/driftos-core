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

  // Load last 6 messages (both roles) so the router can see user↔assistant
  // context, not just bare user turns. Without assistant replies the router
  // can't tell a follow-up like "what was the exact error?" from a brand-new
  // user topic, and mis-branches. 6 ≈ 3 turns, enough for short-term context
  // without bloating the prompt.
  const messages = await prisma.message.findMany({
    where: {
      branchId: ctx.currentBranch.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
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
