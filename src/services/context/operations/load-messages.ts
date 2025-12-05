import type { ContextContext } from '../types';
import { prisma } from '@plugins/prisma';

export async function loadMessages(ctx: ContextContext): Promise<ContextContext> {
  const messages = await prisma.message.findMany({
    where: { branchId: ctx.branchId },
    orderBy: { createdAt: 'asc' },
    take: ctx.policy.maxMessages,
  });

  ctx.messages = messages;
  ctx.reasonCodes.push(`loaded_${messages.length}_messages`);

  return ctx;
}
