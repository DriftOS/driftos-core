import type { DriftContext } from '@/services/drift/types';
import { getConfig } from '@plugins/env';
import { parseResponse, buildPrompt, callLLM } from './helpers';

/**
 * ClassifyRoute Operation
 *
 * Calls LLM to determine: STAY, ROUTE, or BRANCH
 */
export async function classifyRoute(ctx: DriftContext): Promise<DriftContext> {
  const config = getConfig();

  // Build prompt
  const currentBranch = ctx.branches?.find((b) => b.isCurrentBranch);
  const otherBranches = ctx.branches?.filter((b) => !b.isCurrentBranch);

  const prompt = buildPrompt(ctx.content, currentBranch, otherBranches ?? []);
  // Call LLM
  const response = await callLLM(prompt, config);

  const classification = parseResponse(response, currentBranch?.id);
  ctx.classification = classification;
  ctx.reasonCodes.push(`classified_${classification.action.toLowerCase()}`);

  return ctx;
}
