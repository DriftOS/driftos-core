import { factsService } from '@/services/facts';
import type { DriftContext } from '../types';
import { prisma } from '@plugins/prisma';
import { createLogger } from '@utils/logger';

const logger = createLogger('drift');

/**
 * ExecuteRoute Operation
 *
 * Creates message, creates branch if needed, updates centroid.
 */
export async function executeRoute(ctx: DriftContext): Promise<DriftContext> {
  if (!ctx.classification) {
    throw new Error('No classification result');
  }

  const { action, targetBranchId } = ctx.classification;

  let branchId: string;

  switch (action) {
    case 'STAY':
      // Use current branch
      if (!ctx.currentBranch) {
        throw new Error('No current branch to stay in');
      }
      branchId = ctx.currentBranch.id;
      break;

    case 'ROUTE':
      // Route to existing branch
      if (!targetBranchId) {
        throw new Error('ROUTE action requires targetBranchId');
      }
      branchId = targetBranchId;
      break;

    case 'BRANCH':
      // Create new branch
      const newBranch = await prisma.branch.create({
        data: {
          conversationId: ctx.conversationId,
          parentId: ctx.currentBranch?.id ?? null,
          summary: ctx.classification?.newBranchTopic ?? ctx.content.slice(0, 100), // Initial summary from first message
          centroid: ctx.embedding ?? [],
        },
      });
      branchId = newBranch.id;
      ctx.reasonCodes.push('branch_created');
      break;
  }

  // Async fact extraction when leaving a branch
  if (action === 'BRANCH' && ctx.currentBranch) {
    // Fire and forget - don't block response
    factsService
      .extract(ctx.currentBranch.id)
      .catch((err) =>
        logger.warn({ err, branchId: ctx.currentBranch?.id }, 'Async fact extraction failed')
      );
    ctx.reasonCodes.push('facts_extraction_triggered');
  }

  if (action === 'ROUTE' && ctx.currentBranch) {
    factsService
      .extract(ctx.currentBranch.id)
      .catch((err) =>
        logger.warn({ err, branchId: ctx.currentBranch?.id }, 'Async fact extraction failed')
      );
    ctx.reasonCodes.push('facts_extraction_triggered');
  }

  // Create message
  const message = await prisma.message.create({
    data: {
      branchId,
      role: ctx.role,
      content: ctx.content,
      embedding: ctx.embedding ?? [],
    },
  });

  // Update branch centroid (running average)
  if (ctx.embedding && action !== 'BRANCH') {
    await updateCentroid(branchId, ctx.embedding);
  }

  // Load the branch for result
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: branchId },
  });

  ctx.message = message;
  ctx.branch = branch;
  ctx.reasonCodes.push('message_created');

  return ctx;
}

async function updateCentroid(branchId: string, newEmbedding: number[]): Promise<void> {
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: branchId },
    include: { _count: { select: { messages: true } } },
  });

  const messageCount = branch._count.messages;
  const oldCentroid = branch.centroid as number[];

  if (oldCentroid.length === 0) {
    await prisma.branch.update({
      where: { id: branchId },
      data: { centroid: newEmbedding },
    });
    return;
  }

  // Running average: new = old + (new - old) / n
  const updatedCentroid = oldCentroid.map(
    (val, i) => val + (newEmbedding[i]! - val) / messageCount
  );

  await prisma.branch.update({
    where: { id: branchId },
    data: { centroid: updatedCentroid },
  });
}
