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

  const currentBranch = ctx.branches?.find((b) => b.isCurrentBranch);
  const otherBranches = ctx.branches?.filter((b) => !b.isCurrentBranch) ?? [];

  // Assistant messages always STAY - they are responses to user messages
  // and should remain in the same branch context
  if (ctx.role === 'assistant') {
    ctx.classification = {
      action: 'STAY',
      reason: 'Assistant messages stay in current branch',
      confidence: 1.0,
    };
    ctx.reasonCodes.push('assistant_auto_stay');
    return ctx;
  }

  // Build prompt for user messages
  const prompt = buildPrompt(ctx.content, currentBranch, otherBranches);
  // Call LLM
  const response = await callLLM(prompt, config);

  const classification = parseResponse(response, currentBranch?.id);
  
  // Safety check: First message MUST be BRANCH regardless of LLM response
  if (!currentBranch && otherBranches.length === 0 && classification.action !== 'BRANCH') {
    ctx.classification = {
      action: 'BRANCH',
      reason: classification.reason || 'First message in conversation',
      confidence: classification.confidence,
      newBranchTopic: classification.newBranchTopic || ctx.content.slice(0, 100),
    };
    ctx.reasonCodes.push('first_message_forced_branch');
    return ctx;
  }
  
  ctx.classification = classification;
  ctx.reasonCodes.push(`classified_${classification.action.toLowerCase()}`);

  return ctx;
}
