/**
 * Core types for the orchestration pattern
 */

export interface PerformanceTracker {
  track(stage: string, duration: number): void;
  getMetrics(): Record<string, number>;
  getTotalDuration(): number;
}

export interface BasePipelineContext {
  requestId: string;
  startTime: number;
  perfTracker?: PerformanceTracker;
}

export interface OperationContext extends BasePipelineContext {
  results: Record<string, unknown>;
  errors: Error[];
  metadata: Record<string, unknown>;
}

export type PipelineOperation<TContext extends OperationContext> = (
  context: TContext
) => Promise<TContext>;

export interface PipelineStage<TContext extends OperationContext> {
  name: string;
  operation: PipelineOperation<TContext>;
  critical?: boolean;
  timeout?: number;
}

export interface OrchestratorConfig {
  name: string;
  timeout?: number;
  enableMetrics?: boolean;
  logErrors?: boolean;
}

export interface OrchestratorResult<TResult> {
  success: boolean;
  data?: TResult;
  error?: Error;
  duration: number;
  metrics?: Record<string, number>;
}

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public readonly stage: string,
    public readonly context?: unknown,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}
