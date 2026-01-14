import { BaseOrchestrator, DefaultPerformanceTracker } from '@core/orchestration';
import type { PipelineStage } from '@core/orchestration';
import type { ContextContext, ContextResult, ContextInput, ContextPolicy } from './types';
import * as ops from './operations';

const DEFAULT_POLICY: ContextPolicy = {
  maxMessages: 50,
  includeAncestorFacts: true,
  maxAncestorDepth: 5,
};

export class ContextOrchestrator extends BaseOrchestrator<
  ContextContext,
  ContextResult,
  ContextInput
> {
  constructor() {
    super({
      name: 'ContextOrchestrator',
      timeout: 5000,
      enableMetrics: true,
      logErrors: true,
    });
  }

  protected async initializeContext(input: ContextInput): Promise<ContextContext> {
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

  protected getPipeline(): PipelineStage<ContextContext>[] {
    return [
      { name: 'load-branch', operation: ops.loadBranch, critical: true },
      { name: 'load-messages', operation: ops.loadMessages, critical: true },
      { name: 'load-all-facts', operation: ops.loadAllFacts, critical: true },
    ];
  }

  protected buildResult(ctx: ContextContext): ContextResult {
    return {
      branchId: ctx.branchId,
      branchTopic: ctx.branch?.summary ?? 'Unknown',
      messages: (ctx.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      allFacts: (ctx.allFacts ?? []).map((bf) => ({
        branchId: bf.branchId,
        branchTopic: bf.branchTopic,
        isCurrent: bf.isCurrent,
        facts: bf.facts.map((f) => ({
          id: f.id,
          key: f.key,
          value: f.value,
          confidence: f.confidence,
        })),
      })),
    };
  }
}
