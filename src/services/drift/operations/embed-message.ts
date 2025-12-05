import type { DriftContext } from '../types';
import { embed } from '@services/local-embeddings';

/**
 * EmbedMessage Operation
 *
 * Generates embedding for the message content.
 */
export async function embedMessage(ctx: DriftContext): Promise<DriftContext> {
  ctx.embedding = await embed(ctx.content);
  ctx.reasonCodes.push('message_embedded');

  return ctx;
}
