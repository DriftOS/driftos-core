import type { FactsContext } from '../types';
import { prisma } from '@plugins/prisma';

export async function saveFacts(ctx: FactsContext): Promise<FactsContext> {
  if (!ctx.extractedFacts || ctx.extractedFacts.length === 0) {
    ctx.savedFacts = [];
    return ctx;
  }

  // Delete existing facts for this branch (replace strategy)
  await prisma.fact.deleteMany({
    where: { branchId: ctx.branchId },
  });

  // Create new facts
  const facts = await prisma.$transaction(
    ctx.extractedFacts.map((f) =>
      prisma.fact.create({
        data: {
          branchId: ctx.branchId,
          key: f.key,
          value: f.value,
          confidence: f.confidence,
          messageId: f.messageId,
        },
      })
    )
  );

  ctx.savedFacts = facts;
  ctx.reasonCodes.push('facts_saved');

  return ctx;
}
