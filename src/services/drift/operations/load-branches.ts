import type { DriftContext, BranchSummary } from '../types';
import { prisma } from '@plugins/prisma';

/**
 * LoadBranches Operation
 *
 * Loads branches for conversation, finds current branch, builds summaries for LLM.
 */
export async function loadBranches(ctx: DriftContext): Promise<DriftContext> {
  // Get conversation to check lastActiveBranchId
  const conversation = await prisma.conversation.findUnique({
    where: { id: ctx.conversationId },
    select: { lastActiveBranchId: true },
  });

  // Get all branches for this conversation
  const branches = await prisma.branch.findMany({
    where: { conversationId: ctx.conversationId },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // First message in new conversation - no branches yet
  if (branches.length === 0) {
    ctx.reasonCodes.push('new_conversation');
    return ctx;
  }

  // Find current branch (priority: explicit ctx.currentBranchId > conversation.lastActiveBranchId > most recent)
  const currentBranch = ctx.currentBranchId
    ? branches.find((b) => b.id === ctx.currentBranchId)
    : conversation?.lastActiveBranchId
    ? branches.find((b) => b.id === conversation.lastActiveBranchId)
    : branches[0]; // Fallback to most recently updated

  if (!currentBranch) {
    throw new Error(`Branch not found: ${ctx.currentBranchId || conversation?.lastActiveBranchId}`);
  }

  ctx.currentBranch = currentBranch;

  // Build summaries for LLM (limit to policy max)
  const summaries: BranchSummary[] = branches
    .slice(0, ctx.policy.maxBranchesForContext)
    .map((b) => ({
      id: b.id,
      summary: b.summary ?? 'No summary',
      messageCount: b._count.messages,
      isCurrentBranch: b.id === currentBranch.id,
    }));

  ctx.branches = summaries;
  ctx.reasonCodes.push('branches_loaded');

  return ctx;
}
