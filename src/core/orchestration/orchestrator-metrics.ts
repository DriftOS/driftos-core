/**
 * Orchestrator Metrics - Prometheus Integration
 *
 * Shared metrics for ALL orchestrators - write once, use everywhere!
 */

import promClient from 'prom-client';

/**
 * Generic metrics that apply to ALL orchestrators
 */
export const OrchestratorMetrics = {
  /**
   * Track active operations across all services
   */
  activeOperations: new promClient.Gauge({
    name: 'orchestrator_active_operations',
    help: 'Number of currently active orchestrator operations',
    labelNames: ['service'],
  }),

  /**
   * Track pipeline duration across all services
   */
  pipelineDuration: new promClient.Histogram({
    name: 'orchestrator_pipeline_duration_ms',
    help: 'Duration of orchestrator pipeline execution',
    labelNames: ['service', 'status'],
    buckets: [1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000], // Finer granularity for accurate percentiles
  }),

  /**
   * Track stage latencies generically
   */
  stageLatency: new promClient.Histogram({
    name: 'orchestrator_stage_latency_ms',
    help: 'Latency of individual pipeline stages',
    labelNames: ['service', 'stage'],
    buckets: [0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000], // Finer granularity for sub-millisecond tracking
  }),

  /**
   * Track pipeline errors
   */
  pipelineErrors: new promClient.Counter({
    name: 'orchestrator_pipeline_errors_total',
    help: 'Total number of pipeline errors',
    labelNames: ['service', 'stage'],
  }),
};
