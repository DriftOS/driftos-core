import { DriftOrchestrator } from './orchestrator.js';
import type { DriftResult, DriftInput } from './types/index.js';
import type { OrchestratorResult } from '@core/orchestration/index.js';

/**
 * Drift Service
 *
 * Routes messages to the correct conversation branch.
 */

export class DriftService {
  private static instance: DriftService;
  private orchestrator: DriftOrchestrator;

  private constructor() {
    this.orchestrator = new DriftOrchestrator();
  }

  public static getInstance(): DriftService {
    if (!DriftService.instance) {
      DriftService.instance = new DriftService();
    }
    return DriftService.instance;
  }

  async route(
    conversationId: string,
    content: string,
    options: {
      role?: 'user' | 'assistant';
      currentBranchId?: string;
    } = {}
  ): Promise<OrchestratorResult<DriftResult>> {
    const input: DriftInput = {
      conversationId,
      content,
      role: options.role ?? 'user',
      currentBranchId: options.currentBranchId,
    };

    return this.orchestrator.execute(input);
  }

  public async healthCheck(): Promise<{ status: string; service: string }> {
    return {
      status: 'healthy',
      service: 'DriftService',
    };
  }
}

export const driftService = DriftService.getInstance();
