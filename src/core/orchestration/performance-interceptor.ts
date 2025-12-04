import type { OperationContext, PipelineOperation } from './types.js';

/**
 * Interceptor that automatically tracks performance for each pipeline operation
 */
export class PerformanceInterceptor {
  /**
   * Wraps a pipeline operation to automatically track its performance
   */
  static wrap<TContext extends OperationContext>(
    operation: PipelineOperation<TContext>,
    operationName: string
  ): PipelineOperation<TContext> {
    return async (context: TContext): Promise<TContext> => {
      const startTime = Date.now();

      try {
        const result = await operation(context);
        const duration = Date.now() - startTime;

        // Track performance if tracker is available
        if (context.perfTracker) {
          context.perfTracker.track(operationName, duration);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Track performance even on error
        if (context.perfTracker) {
          context.perfTracker.track(`${operationName}_error`, duration);
        }

        throw error;
      }
    };
  }

  /**
   * Wraps all operations in a pipeline with performance tracking
   */
  static wrapPipeline<TContext extends OperationContext>(
    operations: Array<{ name: string; operation: PipelineOperation<TContext> }>
  ): PipelineOperation<TContext>[] {
    return operations.map(({ name, operation }) => PerformanceInterceptor.wrap(operation, name));
  }
}
