// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatBranchDisplay(
  branch: { id: string; summary: string; context?: string; factKeys?: string[] } | undefined
): string {
  if (!branch) return 'None';
  const contextPart = branch.context ? ` (${branch.context})` : '';
  const factsPart = branch.factKeys && branch.factKeys.length > 0
    ? ` [Facts: ${branch.factKeys.join(', ')}]`
    : '';
  return `${branch.summary}${contextPart}${factsPart}`;
}

function formatOtherBranchesList(
  branches: { id: string; summary: string; context?: string; factKeys?: string[] }[]
): string {
  if (branches.length === 0) return 'None';

  return branches
    .map((b, idx) => {
      const contextPart = b.context ? ` (${b.context})` : '';
      const factsPart = b.factKeys && b.factKeys.length > 0
        ? ` [Facts: ${b.factKeys.join(', ')}]`
        : '';
      return `${idx + 1}. ${b.summary}${contextPart}${factsPart}`;
    })
    .join('\n');
}

function formatConversationHistory(
  recentMessages?: Array<{ role: string; content: string }>
): string {
  if (!recentMessages || recentMessages.length === 0) return '';

  return '\n\nRecent Messages in This Topic:\n' +
    recentMessages.map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join('\n');
}

// ============================================================================
// ROUTING-ONLY PROMPT (no facts extraction)
// ============================================================================

function buildRoutingOnlyPrompt(
  message: string,
  currentBranchDisplay: string,
  otherBranchList: string,
  conversationHistory: string
): string {
  return `You are a conversation router. Your job: Route the message to the right branch.

WHY: Each branch has separate memory. Splitting too early = AI loses context.

Current topic: ${currentBranchDisplay}
Other topics:
${otherBranchList}${conversationHistory}

New message: "${message}"

ROUTING RULES:
- STAY: Message relates to current topic, or would benefit from current context
- ROUTE: Message fits an OTHER topic better - semantically related topics should share branches (return topic NUMBER)
- BRANCH: Message is fundamentally different - needs separate memory. MUST provide a short topic name (3-6 words).

Ask: "Would the AI respond BETTER with current context?" → Yes = STAY
Ask: "Is this semantically related to an existing topic?" → Yes = ROUTE to that topic
Ask: "Is this a completely different domain/category?" → Yes = BRANCH

Examples of ROUTE (not BRANCH):
- "golden retrievers" → "cavoodles" (both dog breeds, same domain)
- "Paris hotels" → "London hotels" (both travel/hotels, same domain)
- "mortgage rates" → "property tax" (both home buying, same domain)

Examples of BRANCH:
- "Paris hotels" → "what's the weather?" (travel → weather, different domains)
- "golden retrievers" → "recipe for pasta" (dogs → cooking, different domains)

Default to STAY if uncertain.
Confidence: How certain are you? 0 = no idea, 0.5 = uncertain, 0.8 = confident, 1 = absolutely certain.

IMPORTANT: If action=BRANCH, you MUST provide a newBranchTopic (3-6 words describing the new topic).`;
}

// ============================================================================
// ROUTING + FACTS PROMPT
// ============================================================================

function buildRoutingWithFactsPrompt(
  message: string,
  currentBranchDisplay: string,
  otherBranchList: string,
  conversationHistory: string
): string {
  return `You are a conversation router that also extracts facts. Your job:
1. Route the message to the right branch
2. Extract facts from the conversation

WHY: Each branch has separate memory. Splitting too early = AI loses context.

Current topic: ${currentBranchDisplay}
Other topics:
${otherBranchList}${conversationHistory}

New message: "${message}"

ROUTING RULES:
- STAY: Message relates to current topic, or would benefit from current context
- ROUTE: Message fits an OTHER topic better - semantically related topics should share branches (return topic NUMBER)
- BRANCH: Message is fundamentally different - needs separate memory. MUST provide a short topic name (3-6 words).

Ask: "Would the AI respond BETTER with current context?" → Yes = STAY
Ask: "Is this semantically related to an existing topic?" → Yes = ROUTE to that topic
Ask: "Is this a completely different domain/category?" → Yes = BRANCH

Examples of ROUTE (not BRANCH):
- "golden retrievers" → "cavoodles" (both dog breeds, same domain)
- "Paris hotels" → "London hotels" (both travel/hotels, same domain)
- "mortgage rates" → "property tax" (both home buying, same domain)

Examples of BRANCH:
- "Paris hotels" → "what's the weather?" (travel → weather, different domains)
- "golden retrievers" → "recipe for pasta" (dogs → cooking, different domains)

Default to STAY if uncertain.
Confidence: How certain are you? 0 = no idea, 0.5 = uncertain, 0.8 = confident, 1 = absolutely certain.

IMPORTANT: If action=BRANCH, you MUST provide a newBranchTopic (3-6 words describing the new topic).

FACT EXTRACTION RULES:
- branchContext: A one-sentence summary of what's being discussed (e.g., "discussing London house purchase")
- Extract ONLY important, actionable facts (decisions, preferences, key entities like places/dates/amounts, constraints)
- DO NOT extract: Questions, greetings, acknowledgments, trivial details
- DO NOT extract redundant facts: If "destination: London" exists, don't also add "preference: London" or "location: London"
- DO NOT extract obvious context: If branchContext is "house buying in London", don't extract "intention: buy"
- DO NOT invent or hallucinate facts
- Use specific, descriptive keys (e.g., "destination", "budget_max", "mortgage_rate", "area_preference")
- Avoid generic keys like "preference", "intention", "topic" - be specific about what the preference/intention is
- isUpdate field (CRITICAL):
  * If fact key is in [Facts: ...] → set isUpdate=true, ONLY return NEW values not already stored
  * If fact key NOT in [Facts: ...] → set isUpdate=false, return all values
  * Example: [Facts: mortgage_rate] exists, user says "other banks?" → isUpdate=true, values=[] (no new specific values)
  * Example: [Facts: mortgage_rate] exists, user says "Barclays has 4.1%" → isUpdate=true, values=[{value: "Barclays"}, {value: "4.1%"}]
- DO NOT re-extract values that are already stored - only extract NEW information from current message
- Each fact key can have multiple values (e.g., area_preference: [{value: "good schools"}, {value: "near parks"}])
- Confidence: 1.0 = explicit/definitive, 0.9 = stated clearly, 0.7 = implied
- SUPERSEDES FIELD (REQUIRED):
  - ALWAYS include "supersedes" field for every value (use empty array [] if no replacement)
  - Example NEW fact: {"value": "good schools", "confidence": 0.9, "supersedes": []}
  - Example REPLACEMENT: {"value": "London", "confidence": 0.9, "supersedes": ["Paris"]}
  - ONLY populate supersedes array for CORRECTIONS/REPLACEMENTS, otherwise use []
- If no important facts to extract, return empty array [] for facts
`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export function buildPrompt(
  message: string,
  currentBranch: { id: string; summary: string; context?: string; factKeys?: string[] } | undefined,
  otherBranches: { id: string; summary: string; context?: string; factKeys?: string[] }[],
  recentMessages?: Array<{ role: string; content: string }>,
  extractFacts: boolean = false // Default to routing-only
): string {
  // Format common data
  const currentBranchDisplay = formatBranchDisplay(currentBranch);
  const otherBranchList = formatOtherBranchesList(otherBranches);
  const conversationHistory = formatConversationHistory(recentMessages);

  // Use routing-only or routing+facts prompt based on flag
  if (extractFacts) {
    return buildRoutingWithFactsPrompt(
      message,
      currentBranchDisplay,
      otherBranchList,
      conversationHistory
    );
  } else {
    return buildRoutingOnlyPrompt(
      message,
      currentBranchDisplay,
      otherBranchList,
      conversationHistory
    );
  }
}
