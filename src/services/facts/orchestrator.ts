import { BaseOrchestrator, DefaultPerformanceTracker } from '@core/orchestration';
import type { PipelineStage } from '@core/orchestration';
import type { FactsContext, FactsResult, FactsInput, FactsPolicy } from './types';
import * as ops from './operations';

const DEFAULT_POLICY: FactsPolicy = {
  minConfidence: 0.7,
};

export class FactsOrchestrator extends BaseOrchestrator<FactsContext, FactsResult, FactsInput> {
  constructor() {
    super({
      name: 'FactsOrchestrator',
      timeout: 15000,
      enableMetrics: true,
      logErrors: true,
    });
  }

  protected async initializeContext(input: FactsInput): Promise<FactsContext> {
    return {
      branchId: input.branchId,
      policy: { ...DEFAULT_POLICY, ...input.policy },
      requestId: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      perfTracker: new DefaultPerformanceTracker(),
      results: {},
      errors: [],
      metadata: { orchestrator: this.getName() },
      reasonCodes: [],
    };
  }

  protected getPipeline(): PipelineStage<FactsContext>[] {
    return [
      { name: 'load-messages', operation: ops.loadMessages, critical: true },
      { name: 'extract-facts', operation: ops.extractFacts, critical: true },
      { name: 'save-facts', operation: ops.saveFacts, critical: true },
    ];
  }

  protected buildResult(ctx: FactsContext): FactsResult {
    return {
      branchId: ctx.branchId,
      facts: ctx.savedFacts ?? [],
      extractedCount: ctx.extractedFacts?.length ?? 0,
      reasonCodes: ctx.reasonCodes,
    };
  }
}
