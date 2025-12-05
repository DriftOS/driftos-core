import { ContextOrchestrator } from './orchestrator';
import type { ContextResult, ContextPolicy } from './types';
import type { OrchestratorResult } from '@core/orchestration';

export class ContextService {
  private static instance: ContextService;
  private orchestrator: ContextOrchestrator;

  private constructor() {
    this.orchestrator = new ContextOrchestrator();
  }

  public static getInstance(): ContextService {
    if (!ContextService.instance) {
      ContextService.instance = new ContextService();
    }
    return ContextService.instance;
  }

  async get(
    branchId: string,
    options: { policy?: Partial<ContextPolicy> } = {}
  ): Promise<OrchestratorResult<ContextResult>> {
    return this.orchestrator.execute({
      branchId,
      policy: options.policy,
    });
  }

  public async healthCheck(): Promise<{ status: string; service: string }> {
    return { status: 'healthy', service: 'ContextService' };
  }
}

export const contextService = ContextService.getInstance();
