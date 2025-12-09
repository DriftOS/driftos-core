export function buildPrompt(
  message: string,
  currentBranch: { id: string; summary: string } | undefined,
  otherBranches: { id: string; summary: string }[]
): string {
  const otherBranchList =
    otherBranches.length > 0
      ? otherBranches.map((b) => `- ${b.id}: ${b.summary}`).join('\n')
      : 'None';

  return `You are a conversation router. Decide where this message belongs.

Current branch topic: ${currentBranch?.summary ?? 'None (new conversation)'}

Other branches:
${otherBranchList}

New message: "${message}"

Decide:
- STAY: Message DIRECTLY continues discussing "${currentBranch?.summary ?? 'the current topic'}". Must be clearly on-topic.
- ROUTE: Message belongs to a DIFFERENT existing branch (return ROUTE + targetBranchId)
- BRANCH: Message introduces a NEW topic not covered by any branch (return BRANCH + newBranchTopic)

GUIDELINES:
- STAY if the message continues, elaborates, or responds to "${currentBranch?.summary ?? 'the current topic'}"
- BRANCH only if the message is clearly unrelated to the current topic
- When the topic is ambiguous but plausibly connected, prefer STAY

Quick checks:
- Filler (Yes, Ok, Sure, Thanks) → STAY
- Direct responses, elaborations, follow-up questions → STAY
- Comparisons "[X] or [Y]?" about current topic → STAY
- Completely different subject matter, unrelated personal updates → BRANCH
- "Now X", "What about X" → likely BRANCH or ROUTE
- Focus on primary intent, ignore incidental mentions`;
}
