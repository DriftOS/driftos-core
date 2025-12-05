import type { ContextContext } from '../types';
import { prisma } from '@plugins/prisma';

export async function loadBranch(ctx: ContextContext): Promise<ContextContext> {
  const branch = await prisma.branch.findUnique({
    where: { id: ctx.branchId },
  });

  if (!branch) {
    throw new Error(`Branch not found: ${ctx.branchId}`);
  }

  ctx.branch = branch;
  ctx.reasonCodes.push('branch_loaded');

  return ctx;
}
