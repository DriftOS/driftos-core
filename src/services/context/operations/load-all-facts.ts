import type { ContextContext } from '../types';
import { prisma } from '@plugins/prisma';

export async function loadAllFacts(ctx: ContextContext): Promise<ContextContext> {
  if (!ctx.branch) {
    ctx.allFacts = [];
    return ctx;
  }

  // Get all branches in this conversation with their facts
  const allBranches = await prisma.branch.findMany({
    where: { conversationId: ctx.branch.conversationId },
    include: { facts: true },
    orderBy: { createdAt: 'asc' },
  });

  ctx.allFacts = allBranches
    .filter((b) => b.facts.length > 0) // Only branches with facts
    .map((b) => ({
      branchId: b.id,
      branchTopic: b.summary ?? 'Unknown',
      facts: b.facts,
      isCurrent: b.id === ctx.branchId,
    }));

  ctx.reasonCodes.push(`loaded_facts_from_${ctx.allFacts.length}_branches`);

  return ctx;
}
