/**
 * Ephemeral Drift Processing for Demo Routes
 *
 * Processes conversations in-memory without database persistence.
 * Uses LLM-based classify-route for drift decisions (STAY/ROUTE/BRANCH).
 */

import { classifyRoute } from './operations/classify-route';
import type { DriftContext } from './orchestrator';

interface InputMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EphemeralBranch {
  id: string;
  topic: string;
  parentId: string | null;
  messageCount: number;
  facts: string[];
  createdAt: Date;
}

export interface EphemeralMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  branchId: string;
  branchTopic: string;
  action: 'STAY' | 'ROUTE' | 'BRANCH';
  driftAction: 'STAY' | 'BRANCH_SAME_CLUSTER' | 'BRANCH_NEW_CLUSTER';
  metadata?: {
    llmAnalysis?: {
      action: 'STAY' | 'ROUTE' | 'BRANCH';
      targetBranchId?: string;
      newBranchTopic?: string;
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
  };
}

export interface EphemeralState {
  branches: EphemeralBranch[];
  messages: EphemeralMessage[];
  currentBranchId: string;
  currentBranchTopic: string;
}

/**
 * Process messages through LLM-based drift routing without database persistence
 */
export async function processEphemeralConversation(
  messages: InputMessage[],
  options: {
    extractFacts?: boolean;
  } = {},
): Promise<EphemeralState> {
  const branches: EphemeralBranch[] = [];
  const allMessages: EphemeralMessage[] = [];
  let currentBranchId: string | null = null;

  for (const msg of messages) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build context for classify-route
    const ctx: DriftContext = {
      content: msg.content,
      role: msg.role,
      currentBranchId: currentBranchId ?? undefined,
      branches: branches.map(b => ({
        id: b.id,
        topic: b.topic,
        isCurrentBranch: b.id === currentBranchId,
        messageCount: b.messageCount,
      })),
      reasonCodes: [],
    };

    // Call LLM classify-route
    const result = await classifyRoute(ctx);
    const classification = result.classification!;

    let targetBranchId: string;
    let branchTopic: string;

    if (classification.action === 'BRANCH') {
      // Create new branch
      const newBranchId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newBranch: EphemeralBranch = {
        id: newBranchId,
        topic: classification.newBranchTopic || msg.content.slice(0, 100),
        parentId: currentBranchId,
        messageCount: 0,
        facts: [],
        createdAt: new Date(),
      };
      branches.push(newBranch);
      targetBranchId = newBranchId;
      branchTopic = newBranch.topic;
      currentBranchId = newBranchId;
    } else if (classification.action === 'ROUTE' && classification.targetBranchId) {
      // Route to existing branch
      const targetBranch = branches.find(b => b.id === classification.targetBranchId);
      if (targetBranch) {
        targetBranchId = targetBranch.id;
        branchTopic = targetBranch.topic;
        currentBranchId = targetBranchId;
      } else {
        // Fallback: stay in current branch if target not found
        targetBranchId = currentBranchId!;
        branchTopic = branches.find(b => b.id === currentBranchId)?.topic || 'Unknown';
      }
    } else {
      // STAY in current branch
      targetBranchId = currentBranchId!;
      branchTopic = branches.find(b => b.id === currentBranchId)?.topic || 'Unknown';
    }

    // Build LLM analysis metadata if available
    const llmAnalysis = result.llmResponse
      ? {
          action: result.llmResponse.action,
          targetBranchId: result.llmResponse.targetBranchId ?? undefined,
          newBranchTopic: result.llmResponse.newBranchTopic ?? undefined,
          reason: result.llmResponse.reason,
          confidence: result.llmResponse.confidence,
          currentBranch: result.currentBranch
            ? {
                id: result.currentBranch.id,
                summary: result.currentBranch.summary ?? 'Unknown',
              }
            : undefined,
          otherBranches: result.branches
            ?.filter((b) => !b.isCurrentBranch)
            .map((b) => ({
              id: b.id,
              summary: b.summary,
            })),
        }
      : undefined;

    // Create ephemeral message
    const ephemeralMsg: EphemeralMessage = {
      id: messageId,
      role: msg.role,
      content: msg.content,
      branchId: targetBranchId,
      branchTopic,
      action: classification.action,
      driftAction: 'STAY', // LLM-based routing doesn't have cluster concept
      metadata: llmAnalysis ? { llmAnalysis } : undefined,
    };

    // Update branch message count
    const branch = branches.find(b => b.id === targetBranchId);
    if (branch) {
      branch.messageCount++;
    }

    allMessages.push(ephemeralMsg);
  }

  return {
    branches,
    messages: allMessages,
    currentBranchId: currentBranchId!,
    currentBranchTopic: branches.find(b => b.id === currentBranchId)?.topic || 'Unknown',
  };
}
