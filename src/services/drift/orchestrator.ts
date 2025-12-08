import { BaseOrchestrator, DefaultPerformanceTracker } from '@core/orchestration';
import type { PipelineStage } from '@core/orchestration';
import type { DriftContext, DriftResult, DriftInput, DriftPolicy } from './types';
import * as ops from './operations';

const DEFAULT_POLICY: DriftPolicy = {
  maxBranchesForContext: 10,
};

/**
 * Drift Orchestrator
 *
 * Routes messages to the correct conversation branch.
 */
export class DriftOrchestrator extends BaseOrchestrator<DriftContext, DriftResult, DriftInput> {
  constructor() {
    super({
      name: 'DriftOrchestrator',
      timeout: 10000,
      enableMetrics: true,
      logErrors: true,
    });
  }

  protected async initializeContext(input: DriftInput): Promise<DriftContext> {
    return {
      conversationId: input.conversationId,
      content: input.content,
      role: input.role ?? 'user',
      currentBranchId: input.currentBranchId,
      policy: { ...DEFAULT_POLICY, ...input.policy },
      requestId: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      perfTracker: new DefaultPerformanceTracker(),
      results: {},
      errors: [],
      metadata: {
        orchestrator: this.getName(),
      },
      reasonCodes: [],
    };
  }

  protected getPipeline(): PipelineStage<DriftContext>[] {
    return [
      { name: 'validate-input', operation: ops.validateInput, critical: true },
      { name: 'load-branches', operation: ops.loadBranches, critical: true },
      //{ name: 'embed-message', operation: ops.embedMessage, critical: true },
      { name: 'classify-route', operation: ops.classifyRoute, critical: true },
      { name: 'execute-route', operation: ops.executeRoute, critical: true },
    ];
  }

  protected buildResult(ctx: DriftContext): DriftResult {
    if (!ctx.branch || !ctx.message) {
      throw new Error('Pipeline incomplete: missing branch or message');
    }

    return {
      action: ctx.classification?.action ?? 'STAY',
      branchId: ctx.branch.id,
      messageId: ctx.message.id,
      previousBranchId: ctx.currentBranch?.id !== ctx.branch.id ? ctx.currentBranchId : undefined,
      isNewBranch: ctx.classification?.action === 'BRANCH',
      reason: ctx.classification?.reason ?? 'unknown',
      reasonCodes: ctx.reasonCodes,
      metadata: ctx.metadata,
      branchTopic: ctx.branch.summary ?? 'Unknown',
      confidence: ctx.classification?.confidence ?? 0,
    };
  }
}
