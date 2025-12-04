import type {
  OperationContext,
  OrchestratorConfig,
  OrchestratorResult,
  OrchestratorError,
  PipelineStage,
} from './types.js';
import { PerformanceInterceptor } from './performance-interceptor.js';
import { DefaultPerformanceTracker, NullPerformanceTracker } from './performance-tracker.js';
import { OrchestratorMetrics } from './orchestrator-metrics.js';

/**
 * Abstract base class for all orchestrators following the golden pattern
 */
export abstract class BaseOrchestrator<
  TContext extends OperationContext,
  TResult,
  TInput = unknown,
> {
  protected config: Required<OrchestratorConfig>;

  constructor(config: OrchestratorConfig) {
    this.config = {
      name: config.name,
      timeout: config.timeout ?? 30000,
      enableMetrics: config.enableMetrics ?? true,
      logErrors: config.logErrors ?? true,
    };
  }

  /**
   * Initialize the pipeline context from input
   */
  protected abstract initializeContext(input: TInput): Promise<TContext>;

  /**
   * Define the pipeline stages
   */
  protected abstract getPipeline(): PipelineStage<TContext>[];

  /**
   * Build the final result from the context
   */
  protected abstract buildResult(context: TContext): TResult;

  /**
   * Execute the orchestration pipeline
   */
  async execute(input: TInput): Promise<OrchestratorResult<TResult>> {
    const startTime = Date.now();
    let context: TContext | undefined;

    // Increment active operations
    if (this.config.enableMetrics) {
      OrchestratorMetrics.activeOperations.inc({ service: this.config.name });
    }

    try {
      // Initialize context
      context = await this.initializeContext(input);

      // Add performance tracker if metrics are enabled
      if (this.config.enableMetrics && !context.perfTracker) {
        context.perfTracker = new DefaultPerformanceTracker();
      } else if (!context.perfTracker) {
        context.perfTracker = new NullPerformanceTracker();
      }

      // Get and execute pipeline
      const pipeline = this.getPipeline();

      // Run pipeline with timeout
      context = await this.runPipelineWithTimeout(context, pipeline);

      // Build result
      const result = this.buildResult(context);

      const duration = Date.now() - startTime;

      // Record success metrics
      if (this.config.enableMetrics) {
        OrchestratorMetrics.pipelineDuration.observe(
          { service: this.config.name, status: 'success' },
          duration
        );
        OrchestratorMetrics.activeOperations.dec({ service: this.config.name });
      }

      return {
        success: true,
        data: result,
        duration,
        metrics: context.perfTracker?.getMetrics(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      if (this.config.enableMetrics) {
        OrchestratorMetrics.pipelineDuration.observe(
          { service: this.config.name, status: 'error' },
          duration
        );
        OrchestratorMetrics.pipelineErrors.inc({ service: this.config.name, stage: 'unknown' });
        OrchestratorMetrics.activeOperations.dec({ service: this.config.name });
      }

      if (this.config.logErrors) {
        console.error(`[${this.config.name}] Orchestration error:`, error);
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
        metrics: context?.perfTracker?.getMetrics(),
      };
    }
  }

  /**
   * Run the pipeline with timeout protection
   */
  private async runPipelineWithTimeout(
    context: TContext,
    pipeline: PipelineStage<TContext>[]
  ): Promise<TContext> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Pipeline timeout after ${this.config.timeout}ms in orchestrator: ${this.config.name}`
          ) as OrchestratorError
        );
      }, this.config.timeout);

      this.runPipeline(context, pipeline)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute the pipeline stages sequentially
   */
  private async runPipeline(
    context: TContext,
    pipeline: PipelineStage<TContext>[]
  ): Promise<TContext> {
    let currentContext = context;

    for (const stage of pipeline) {
      const stageStartTime = Date.now();
      try {
        // Wrap operation with performance tracking
        const wrappedOperation = PerformanceInterceptor.wrap(stage.operation, stage.name);

        // Apply stage-specific timeout if provided
        if (stage.timeout) {
          currentContext = await this.runWithTimeout(
            wrappedOperation,
            currentContext,
            stage.timeout,
            stage.name
          );
        } else {
          currentContext = await wrappedOperation(currentContext);
        }

        // Record stage success metrics
        if (this.config.enableMetrics) {
          const stageDuration = Date.now() - stageStartTime;
          OrchestratorMetrics.stageLatency.observe(
            { service: this.config.name, stage: stage.name },
            stageDuration
          );
        }
      } catch (error) {
        // Record stage error metrics
        if (this.config.enableMetrics) {
          OrchestratorMetrics.pipelineErrors.inc({
            service: this.config.name,
            stage: stage.name,
          });
        }

        // If stage is critical, fail the entire pipeline
        if (stage.critical) {
          throw new Error(
            `Critical stage '${stage.name}' failed: ${error instanceof Error ? error.message : String(error)}`
          ) as OrchestratorError;
        }

        // For non-critical stages, log error and continue
        if (this.config.logErrors) {
          console.warn(`[${this.config.name}] Non-critical stage '${stage.name}' failed:`, error);
        }

        // Add error to context
        currentContext.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return currentContext;
  }

  /**
   * Run an operation with a specific timeout
   */
  private async runWithTimeout<T>(
    operation: (context: TContext) => Promise<T>,
    context: TContext,
    timeout: number,
    stageName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Stage '${stageName}' timeout after ${timeout}ms`) as OrchestratorError);
      }, timeout);

      operation(context)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Get the orchestrator name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if metrics are enabled
   */
  isMetricsEnabled(): boolean {
    return this.config.enableMetrics;
  }
}
