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
  // Optional model override for routing decision
  routingModel?: string; // e.g., 'meta-llama/llama-4-scout-17b-16e-instruct'
  routingProvider?: 'groq' | 'openai' | 'anthropic';
  // Optional: extract facts during routing (default: false for routing-only mode)
  extractFacts?: boolean;
}

/**
 * Branch summary for LLM classification
 */
export interface BranchSummary {
  id: string;
  summary: string;
  context?: string; // Evolving semantic context for routing decisions
  messageCount: number;
  isCurrentBranch: boolean;
  factKeys?: string[]; // Existing fact keys for this branch (for smart fact updates)
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
  // Optional model override for routing decision
  routingModel?: string;
  routingProvider?: 'groq' | 'openai' | 'anthropic';
  // Optional: extract facts during routing (default: false)
  extractFacts?: boolean;

  reasonCodes: string[];
  currentBranch?: Branch;
  branches?: BranchSummary[];
  recentMessages?: Array<{ role: string; content: string }>;
  embedding?: number[];

  classification?: {
    action: RouteAction;
    targetBranchId?: string;
    newBranchTopic?: string;
    reason: string;
    confidence: number;
    // Fact extraction fields
    branchContext?: string;
    facts?: Array<{
      key: string; // Fact key (e.g., "location", "budget", "destination")
      values: Array<{
        value: string;
        confidence: number;
        supersedes?: string[]; // Optional: existing values to mark as superseded
      }>;
      isUpdate: boolean; // true if updating existing fact, false if new
    }>;
  };

  // Raw LLM response for analysis display
  llmResponse?: {
    action: RouteAction;
    targetBranchId?: string | null;
    newBranchTopic?: string | null;
    reason: string;
    confidence: number;
  };

  // Token usage from LLM call
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  llmModel?: string;

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
  isNewCluster: boolean;
  reason: string;
  branchTopic?: string;
  confidence: number;
  similarity: number;
  driftAction: 'STAY' | 'BRANCH_SAME_CLUSTER' | 'BRANCH_NEW_CLUSTER';
  reasonCodes: string[];
  metadata?: {
    llmAnalysis?: {
      action: RouteAction;
      targetBranchId?: string | null;
      newBranchTopic?: string | null;
      reason: string;
      confidence: number;
      currentBranch?: {
        id: string;
        summary: string;
      };
      otherBranches?: Array<{
        id: string;
        summary: string;
      }>;
    };
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    llmModel?: string;
    [key: string]: unknown;
  };
}
