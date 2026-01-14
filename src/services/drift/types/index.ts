import type { OperationContext } from '@core/orchestration/index.js';
import type { Branch, Message } from '@prisma/client';

/**
 * Drift Service Types (Calculation)
 */

export type RouteAction = 'STAY' | 'ROUTE' | 'BRANCH';

/**
 * Policy configuration for drift routing
 */
export interface DriftPolicy {
  maxBranchesForContext: number;
}

/**
 * Input for drift routing
 */
export interface DriftInput {
  conversationId: string;
  content: string;
  role?: 'user' | 'assistant';
  currentBranchId?: string;
  policy?: Partial<DriftPolicy>;
  userId?: string; // Clerk user ID for authenticated users
  clientIp?: string; // For demo user isolation
}

/**
 * Branch summary for LLM classification
 */
export interface BranchSummary {
  id: string;
  summary: string;
  messageCount: number;
  isCurrentBranch: boolean;
}

/**
 * Internal context for drift pipeline
 */
export interface DriftContext extends OperationContext {
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  currentBranchId?: string;
  policy: DriftPolicy;
  userId?: string; // Clerk user ID for authenticated users
  clientIp?: string; // For demo user isolation

  reasonCodes: string[];
  currentBranch?: Branch;
  branches?: BranchSummary[];
  embedding?: number[];

  classification?: {
    action: RouteAction;
    targetBranchId?: string;
    newBranchTopic?: string;
    reason: string;
    confidence: number;
  };

  message?: Message;
  branch?: Branch;
}

/**
 * Result from drift routing
 */
export interface DriftResult {
  action: RouteAction;
  branchId: string;
  messageId: string;
  previousBranchId?: string;
  isNewBranch: boolean;
  reason: string;
  branchTopic?: string;
  confidence: number;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
}
