import type { FactsContext } from '../types';
import { prisma } from '@plugins/prisma';

export async function loadMessages(ctx: FactsContext): Promise<FactsContext> {
  const messages = await prisma.message.findMany({
    where: { branchId: ctx.branchId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    ctx.reasonCodes.push('no_messages');
  }

  ctx.messages = messages;
  ctx.reasonCodes.push('messages_loaded');

  return ctx;
}
