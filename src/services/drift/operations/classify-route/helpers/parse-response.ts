import { DriftContext, RouteAction } from '@/services/drift/types';

export function parseResponse(
  response: string,
  currentBranchId?: string,
  otherBranches?: Array<{ id: string; summary: string }>
): NonNullable<DriftContext['classification']> {
  const wrapper = JSON.parse(response);
  // Unwrap the decision from the top-level object
  const parsed = wrapper.decision;

  let action = parsed.action as RouteAction;
  let targetBranchId = parsed.targetBranchId || undefined;

  // VALIDATION: If BRANCH action but no newBranchTopic, enforce fallback
  if (action === 'BRANCH' && !parsed.newBranchTopic) {
    console.warn('⚠️ LLM returned BRANCH action but null newBranchTopic - using fallback');
    parsed.newBranchTopic = 'New Topic';
  }

  // If ROUTE action, map topic number to branch ID
  if (action === 'ROUTE' && targetBranchId && otherBranches) {
    // LLM returns topic number (1, 2, 3...), convert to actual branch ID
    const topicNumber = parseInt(targetBranchId, 10);
    if (!isNaN(topicNumber) && topicNumber >= 1 && topicNumber <= otherBranches.length) {
      targetBranchId = otherBranches[topicNumber - 1]?.id;
    } else {
      // Invalid topic number - LLM returned bad ROUTE decision
      // Fallback to BRANCH since no valid target exists
      action = 'BRANCH';
      targetBranchId = undefined;
      // Ensure we have a topic name
      if (!parsed.newBranchTopic) {
        parsed.newBranchTopic = 'New Topic';
      }
    }
  }

  // If ROUTE but no valid targetBranchId, fallback to BRANCH
  if (action === 'ROUTE' && !targetBranchId) {
    action = 'BRANCH';
    // Ensure we have a topic name
    if (!parsed.newBranchTopic) {
      parsed.newBranchTopic = 'New Topic';
    }
  }

  // If ROUTE targets the current branch, it's actually a STAY
  if (action === 'ROUTE' && targetBranchId === currentBranchId) {
    action = 'STAY';
    targetBranchId = undefined;
  }

  // Just pass through facts - supersedes is always an array now (Groq strict mode requires it)
  const normalizedFacts = Array.isArray(wrapper.facts) ? wrapper.facts : [];

  return {
    action,
    targetBranchId,
    newBranchTopic: parsed.newBranchTopic || undefined,
    reason: parsed.reason || 'Unknown',
    confidence: parsed.confidence || 0.5,
    // Extract facts from the wrapper (not from parsed.decision)
    // Handle both optional (undefined) and required (empty string) formats
    branchContext: wrapper.branchContext && wrapper.branchContext !== ''
      ? wrapper.branchContext
      : 'general conversation',
    // Handle both optional (undefined) and required (empty array) formats
    // Also normalize null supersedes to empty arrays
    facts: normalizedFacts,
  };
}
