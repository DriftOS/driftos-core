import type { OperationContext } from '@core/orchestration';
import type { Branch, Message, Fact } from '@prisma/client';

/**
 * Context Service Types
 */

export interface ContextPolicy {
  maxMessages: number;
  includeAncestorFacts: boolean;
  maxAncestorDepth: number;
}

export interface ContextInput {
  branchId: string;
  policy?: Partial<ContextPolicy>;
}

export interface BranchFacts {
  branchId: string;
  branchTopic: string;
  facts: Fact[];
  isCurrent: boolean;
}

export interface ContextContext extends OperationContext {
  branchId: string;
  policy: ContextPolicy;
  reasonCodes: string[];

  // Pipeline outputs
  branch?: Branch;
  messages?: Message[];
  ancestors?: Branch[];
  allFacts?: BranchFacts[];
}

/** API-safe message shape (dates serialized, no embeddings) */
export interface ContextMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ContextResult {
  branchId: string;
  branchTopic: string;
  messages: ContextMessage[];
  allFacts: BranchFacts[];
}
