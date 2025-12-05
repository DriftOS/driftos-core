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

Current branch: ${currentBranch?.summary ?? 'None'}

Other branches:
${otherBranchList}

New message: "${message}"

Decide:
- STAY: Message continues, supports, or is related to current topic
- ROUTE: Message returns to a different existing branch
- BRANCH: Message is completely unrelated to all branches

When in doubt, STAY. Only BRANCH for genuinely unrelated topics.

Quick checks:
- Filler (Yes, Ok, Sure, Thanks) → STAY
- Comparisons "[X] or [Y]?" → STAY  
- "Now X", "What about X" → likely BRANCH or ROUTE
- Focus on primary intent, ignore incidental mentions`;
}
