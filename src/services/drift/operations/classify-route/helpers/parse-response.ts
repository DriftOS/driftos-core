import { DriftContext, RouteAction } from '@/services/drift/types';

export function parseResponse(response: string): NonNullable<DriftContext['classification']> {
  const parsed = JSON.parse(response);

  return {
    action: parsed.action as RouteAction,
    targetBranchId: parsed.targetBranchId || undefined,
    newBranchTopic: parsed.newBranchTopic || undefined,
    reason: parsed.reason || 'Unknown',
    confidence: parsed.confidence || 0.5,
  };
}
