import type { DriftContext } from '@/services/drift/types';
import { getConfig } from '@plugins/env';
import { parseResponse, buildPrompt, callLLM } from './helpers';

/**
 * ClassifyRoute Operation
 *
 * Calls LLM to determine: STAY, ROUTE, or BRANCH
 * Optionally extracts facts if ctx.extractFacts is true (default: false)
 */
export async function classifyRoute(ctx: DriftContext): Promise<DriftContext> {
  const config = getConfig();

  const currentBranch = ctx.branches?.find((b) => b.isCurrentBranch);
  const otherBranches = ctx.branches?.filter((b) => !b.isCurrentBranch) ?? [];

  // Get extractFacts flag from context (default: false for routing-only mode)
  const extractFacts = ctx.extractFacts ?? false;

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

  // Build prompt for user messages (with or without facts extraction)
  const prompt = buildPrompt(ctx.content, currentBranch, otherBranches, ctx.recentMessages, extractFacts);

  // Log prompt for debugging
  console.log(`\n=== ROUTING PROMPT (extractFacts: ${extractFacts}) ===`);
  console.log(prompt);
  console.log('======================\n');

  // Call LLM with optional model override from context and extractFacts flag
  const llmResponse = await callLLM(prompt, config, extractFacts, ctx.routingModel, ctx.routingProvider);

  // Log LLM response for debugging
  console.log('\n=== LLM RESPONSE ===');
  console.log(llmResponse.content);
  console.log('====================\n');

  const classification = parseResponse(llmResponse.content, currentBranch?.id, otherBranches);

  // Store token usage and model info
  ctx.tokenUsage = llmResponse.usage;
  ctx.llmModel = llmResponse.model;

  // Store raw LLM response for analysis display
  try {
    const parsedResponse = JSON.parse(llmResponse.content);
    // Extract just the decision part (which has action, reason, confidence, etc.)
    ctx.llmResponse = parsedResponse.decision;
  } catch {
    // If parsing fails, response will not be available for analysis
  }

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
