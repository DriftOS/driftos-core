/**
 * Ephemeral Drift Processing for Demo Routes
 *
 * Processes conversations in-memory without database persistence.
 * Uses LLM-based classify-route for drift decisions (STAY/ROUTE/BRANCH).
 */

import { classifyRoute } from './operations/classify-route';
import type { DriftContext } from './types';
import { getConfig } from '@plugins/env';

interface InputMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Helper function to merge facts from LLM into existing branch facts
 * Handles supersession logic with hallucination guards
 */
function mergeFacts(
  existingFacts: EphemeralBranch['facts'],
  newFacts: NonNullable<DriftContext['classification']>['facts'],
  messageId: string
): void {
  if (!newFacts || newFacts.length === 0) return;

  for (const fact of newFacts) {
    const existingValues = existingFacts[fact.key];

    if (fact.isUpdate && existingValues) {
      // Updating existing fact key
      console.log(
        `[MERGE_FACTS] Updating fact key "${fact.key}" with ${fact.values.length} values (messageId: ${messageId})`
      );
      console.log(
        `[MERGE_FACTS] Existing values:`,
        existingValues.map((ev) => ({
          value: ev.value,
          messageId: ev.messageId,
          status: ev.status,
        }))
      );
      console.log(`[MERGE_FACTS] New values from LLM:`, fact.values);

      for (const newValue of fact.values) {
        // Handle supersession if specified
        if (newValue.supersedes && newValue.supersedes.length > 0) {
          for (const supersededValue of newValue.supersedes) {
            // Guard against hallucinations: only supersede values that actually exist and are active
            const targetIndex = existingValues.findIndex(
              (ev) => ev.value === supersededValue && ev.status === 'active'
            );
            if (targetIndex !== -1) {
              // Update status of existing value (in-place mutation of status field)
              console.log(
                `[MERGE_FACTS] Superseding "${supersededValue}" with "${newValue.value}"`
              );
              existingValues[targetIndex]!.status = 'superseded';
              existingValues[targetIndex]!.supersededBy = messageId;
            } else {
              console.log(
                `[MERGE_FACTS] ⚠️ LLM tried to supersede "${supersededValue}" but it doesn't exist or isn't active (hallucination)`
              );
            }
          }
        }

        // Check if this exact value already exists (avoid duplicates)
        const isDuplicate = existingValues.some((ev) => ev.value === newValue.value);
        if (!isDuplicate) {
          // Add new value
          console.log(`[MERGE_FACTS] Adding new value "${newValue.value}" to key "${fact.key}"`);
          existingValues.push({
            value: newValue.value,
            messageId: messageId,
            confidence: newValue.confidence,
            status: 'active',
            supersededBy: undefined,
          });
        } else {
          console.log(
            `[MERGE_FACTS] ⚠️ Skipping duplicate value "${newValue.value}" for key "${fact.key}"`
          );
        }
      }

      console.log(
        `[MERGE_FACTS] After merge:`,
        existingValues.map((ev) => ({
          value: ev.value,
          messageId: ev.messageId,
          status: ev.status,
        }))
      );
    } else {
      // New fact key or no existing values
      console.log(
        `[MERGE_FACTS] Creating new fact key "${fact.key}" with ${fact.values.length} values`
      );
      existingFacts[fact.key] = fact.values.map((v: { value: string; confidence: number }) => ({
        value: v.value,
        messageId: messageId,
        confidence: v.confidence,
        status: 'active' as const,
        supersededBy: undefined,
      }));
    }
  }
}

export interface EphemeralBranch {
  id: string;
  topic: string; // User-facing label (immutable after creation)
  context?: string; // Evolving semantic summary for routing (optional, updates with conversation)
  parentId: string | null;
  messageCount: number;
  facts: Record<
    string,
    Array<{
      value: string;
      messageId: string; // Origin - which message created this fact
      confidence: number;
      status: 'active' | 'superseded' | 'removed';
      supersededBy?: string; // Terminator - which message superseded/removed this
    }>
  >; // Key -> array of values with full provenance chain
  createdAt: Date;
  lastFactExtractionIndex?: number; // Track which messages we've already extracted facts from
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
  lastProcessedIndex: number;
  // Track routing LLM usage separately from fact extraction
  routingTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  routingModel?: string;
}

/**
 * Process messages through LLM-based drift routing without database persistence
 * Supports incremental processing - only processes new messages if previousState is provided
 *
 * @param extractFacts - If true, extracts facts during routing. If false, only performs routing. Default: false
 */
export async function processEphemeralConversation(
  messages: InputMessage[],
  conversationId: string,
  previousState?: EphemeralState,
  extractFacts: boolean = false // Default to routing-only mode
): Promise<EphemeralState> {
  // Initialize from previous state or start fresh
  const branches: EphemeralBranch[] = previousState?.branches ?? [];
  const allMessages: EphemeralMessage[] = previousState?.messages ?? [];
  let currentBranchId: string | null = previousState?.currentBranchId ?? null;
  const startIndex = previousState?.lastProcessedIndex ?? 0;

  // Track routing token usage across all messages
  let totalRoutingInputTokens = previousState?.routingTokenUsage?.inputTokens ?? 0;
  let totalRoutingOutputTokens = previousState?.routingTokenUsage?.outputTokens ?? 0;
  let totalRoutingTokens = previousState?.routingTokenUsage?.totalTokens ?? 0;
  let routingModel = previousState?.routingModel;

  // Get routing model from config if not already set (for prompt optimization)
  if (!routingModel) {
    const config = getConfig();
    routingModel = config.DRIFT_ROUTING_MODEL;
  }

  // Only process new messages
  const messagesToProcess = messages.slice(startIndex);

  console.log(
    `\n[EPHEMERAL] Processing ${messagesToProcess.length} new messages (startIndex: ${startIndex}, total: ${messages.length})`
  );

  for (let i = 0; i < messagesToProcess.length; i++) {
    const msg = messagesToProcess[i]!;
    const messageIndex = startIndex + i;
    // Deterministic message ID based on conversation ID and message index
    const messageId = `${conversationId}-msg-${messageIndex}`;

    console.log(
      `[EPHEMERAL] Processing message ${messageIndex} role=${msg.role}, content="${msg.content.slice(0, 50)}..."`
    );

    // Assistant messages don't need routing - they stay in the current branch
    if (msg.role === 'assistant') {
      console.log(`[EPHEMERAL] Skipping routing for assistant message (STAY)`);

      const ephemeralMsg: EphemeralMessage = {
        id: messageId,
        role: 'assistant',
        content: msg.content,
        branchId: currentBranchId!,
        branchTopic: branches.find((b) => b.id === currentBranchId)?.topic || 'Unknown',
        action: 'STAY',
        driftAction: 'STAY',
      };
      allMessages.push(ephemeralMsg);

      // Update branch message count
      const branch = branches.find((b) => b.id === currentBranchId);
      if (branch) branch.messageCount++;

      continue; // Skip routing for assistant messages
    }

    // Get recent messages from current branch for context (only for user messages)
    const recentMessages = currentBranchId
      ? allMessages
          .filter((m) => m.branchId === currentBranchId && m.role === 'user')
          .slice(-5)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    // Build context for classify-route (only for user messages)
    const ctx: DriftContext = {
      conversationId,
      content: msg.content,
      role: msg.role,
      currentBranchId: currentBranchId ?? undefined,
      policy: { maxBranchesForContext: 10 },
      branches: branches.map((b) => ({
        id: b.id,
        summary: b.topic, // User-facing topic label
        context: b.context, // Evolving semantic context for routing
        isCurrentBranch: b.id === currentBranchId,
        messageCount: b.messageCount,
        factKeys: Object.keys(b.facts), // Pass existing fact keys for smart updates
      })),
      recentMessages,
      reasonCodes: [],
      routingModel, // Pass model for prompt optimization
      extractFacts, // Pass through extractFacts flag
      requestId: messageId,
      startTime: Date.now(),
      perfTracker: undefined,
      results: {},
      errors: [],
      metadata: {},
    };

    // Call LLM classify-route (only for user messages)
    const result = await classifyRoute(ctx);
    const classification = result.classification!;

    // Accumulate routing token usage
    if (result.tokenUsage) {
      totalRoutingInputTokens += result.tokenUsage.inputTokens;
      totalRoutingOutputTokens += result.tokenUsage.outputTokens;
      totalRoutingTokens += result.tokenUsage.totalTokens;
    }
    if (result.llmModel && !routingModel) {
      routingModel = result.llmModel;
    }

    let targetBranchId: string;
    let branchTopic: string;

    if (classification.action === 'BRANCH') {
      // Create new branch with deterministic ID based on conversation and branch index
      const branchIndex = branches.length;
      const newBranchId = `${conversationId}-branch-${branchIndex}`;

      // Convert LLM facts to Record structure with full provenance
      const factsRecord: Record<
        string,
        Array<{
          value: string;
          messageId: string;
          confidence: number;
          status: 'active' | 'superseded' | 'removed';
          supersededBy?: string;
        }>
      > = {};

      if (classification.facts) {
        for (const fact of classification.facts) {
          factsRecord[fact.key] = fact.values.map((v) => ({
            value: v.value,
            messageId: messageId,
            confidence: v.confidence,
            status: 'active' as const, // New facts start as active
            supersededBy: undefined,
          }));
        }
      }

      const newBranch: EphemeralBranch = {
        id: newBranchId,
        topic: classification.newBranchTopic || msg.content.slice(0, 100),
        context: classification.branchContext, // Use extracted context from LLM
        parentId: currentBranchId,
        messageCount: 0,
        facts: factsRecord,
        createdAt: new Date(),
        lastFactExtractionIndex: 1, // We've extracted facts from the first message
      };
      branches.push(newBranch);
      targetBranchId = newBranchId;
      branchTopic = newBranch.topic;
      currentBranchId = newBranchId;
    } else if (classification.action === 'ROUTE' && classification.targetBranchId) {
      // Route to existing branch - update context and facts
      const targetBranch = branches.find((b) => b.id === classification.targetBranchId);
      if (targetBranch) {
        targetBranchId = targetBranch.id;
        branchTopic = targetBranch.topic;
        currentBranchId = targetBranchId;

        // Update branch context and merge facts from routing call
        targetBranch.context = classification.branchContext;
        mergeFacts(targetBranch.facts, classification.facts, messageId);

        // Update lastFactExtractionIndex to track processed messages
        const branchMessageCount = allMessages.filter((m) => m.branchId === targetBranchId).length;
        targetBranch.lastFactExtractionIndex = branchMessageCount + 1;
      } else {
        // Fallback: stay in current branch if target not found
        targetBranchId = currentBranchId!;
        branchTopic = branches.find((b) => b.id === currentBranchId)?.topic || 'Unknown';
      }
    } else {
      // STAY in current branch - update context and facts
      targetBranchId = currentBranchId!;
      const currentBranch = branches.find((b) => b.id === currentBranchId);
      branchTopic = currentBranch?.topic || 'Unknown';

      if (currentBranch) {
        // Update branch context and merge facts from routing call
        currentBranch.context = classification.branchContext;
        mergeFacts(currentBranch.facts, classification.facts, messageId);

        // Update lastFactExtractionIndex to track processed messages
        const branchMessageCount = allMessages.filter((m) => m.branchId === currentBranchId).length;
        currentBranch.lastFactExtractionIndex = branchMessageCount + 1;
      }
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
    const branch = branches.find((b) => b.id === targetBranchId);
    if (branch) {
      branch.messageCount++;
    }

    allMessages.push(ephemeralMsg);
  }

  // Safety check: If no branch was created (empty messages or error), create a default branch
  if (!currentBranchId && branches.length === 0) {
    const defaultBranchId = `${conversationId}-branch-0`;
    const defaultBranch: EphemeralBranch = {
      id: defaultBranchId,
      topic: 'New Conversation',
      context: 'new conversation',
      parentId: null,
      messageCount: 0,
      facts: {},
      createdAt: new Date(),
      lastFactExtractionIndex: 0,
    };
    branches.push(defaultBranch);
    currentBranchId = defaultBranchId;
  } else if (!currentBranchId && branches.length > 0) {
    // If branches exist but no currentBranchId, use the first branch
    currentBranchId = branches[0]!.id;
  }

  return {
    branches,
    messages: allMessages,
    currentBranchId: currentBranchId!,
    currentBranchTopic: branches.find((b) => b.id === currentBranchId)?.topic || 'Unknown',
    lastProcessedIndex: messages.length,
    routingTokenUsage: {
      inputTokens: totalRoutingInputTokens,
      outputTokens: totalRoutingOutputTokens,
      totalTokens: totalRoutingTokens,
    },
    routingModel,
  };
}
