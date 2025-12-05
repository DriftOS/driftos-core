import { FactsOrchestrator } from './orchestrator';
import type { FactsResult, FactsPolicy } from './types';
import type { OrchestratorResult } from '@core/orchestration';

export class FactsService {
  private static instance: FactsService;
  private orchestrator: FactsOrchestrator;

  private constructor() {
    this.orchestrator = new FactsOrchestrator();
  }

  public static getInstance(): FactsService {
    if (!FactsService.instance) {
      FactsService.instance = new FactsService();
    }
    return FactsService.instance;
  }

  async extract(
    branchId: string,
    options: { policy?: Partial<FactsPolicy> } = {}
  ): Promise<OrchestratorResult<FactsResult>> {
    return this.orchestrator.execute({
      branchId,
      policy: options.policy,
    });
  }

  public async healthCheck(): Promise<{ status: string; service: string }> {
    return {
      status: 'healthy',
      service: 'FactsService',
    };
  }
}

export const factsService = FactsService.getInstance();
