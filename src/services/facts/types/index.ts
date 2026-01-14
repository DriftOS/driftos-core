import type { OperationContext } from '@core/orchestration';
import type { Message, Fact } from '@prisma/client';

/**
 * Facts Service Types
 */

export interface FactsPolicy {
  minConfidence: number;
}

export interface FactsInput {
  branchId: string;
  policy?: Partial<FactsPolicy>;
}

export interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  messageId?: string | null;
}

export interface FactsContext extends OperationContext {
  branchId: string;
  policy: FactsPolicy;
  reasonCodes: string[];

  // Pipeline outputs
  messages?: Message[];
  extractedFacts?: ExtractedFact[];
  savedFacts?: Fact[];
  branchTopic?: string;
}

export interface FactsResult {
  branchId: string;
  facts: Fact[];
  extractedCount: number;
  reasonCodes: string[];
}
