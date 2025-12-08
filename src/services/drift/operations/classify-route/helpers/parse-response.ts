import { DriftContext, RouteAction } from '@/services/drift/types';

export function parseResponse(
  response: string,
  currentBranchId?: string
): NonNullable<DriftContext['classification']> {
  const parsed = JSON.parse(response);

  let action = parsed.action as RouteAction;
  let targetBranchId = parsed.targetBranchId || undefined;

  // If ROUTE targets the current branch, it's actually a STAY
  if (action === 'ROUTE' && targetBranchId === currentBranchId) {
    action = 'STAY';
    targetBranchId = undefined;
  }

  return {
    action,
    targetBranchId,
    newBranchTopic: parsed.newBranchTopic || undefined,
    reason: parsed.reason || 'Unknown',
    confidence: parsed.confidence || 0.5,
  };
}
