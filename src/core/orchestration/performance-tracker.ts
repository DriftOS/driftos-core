import { PerformanceTracker } from './types.js';

/**
 * Default implementation of PerformanceTracker
 */
export class DefaultPerformanceTracker implements PerformanceTracker {
  private metrics: Record<string, number> = {};
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  track(stage: string, duration: number): void {
    this.metrics[stage] = duration;
  }

  getMetrics(): Record<string, number> {
    return { ...this.metrics };
  }

  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Null implementation for when performance tracking is disabled
 */
export class NullPerformanceTracker implements PerformanceTracker {
  track(_stage: string, _duration: number): void {
    // No-op
  }

  getMetrics(): Record<string, number> {
    return {};
  }

  getTotalDuration(): number {
    return 0;
  }
}
