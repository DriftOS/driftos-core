export function buildPrompt(
  message: string,
  currentBranch: { id: string; summary: string } | undefined,
  otherBranches: { id: string; summary: string }[]
): string {
  const otherBranchList =
    otherBranches.length > 0
      ? otherBranches.map((b) => `- ${b.id}: ${b.summary}`).join('\n')
      : 'None';

  const currentBranchInfo = currentBranch
    ? `${currentBranch.id}: ${currentBranch.summary}`
    : 'None (new conversation)';

  return `You are a conversation router. Decide where this message belongs.

Current branch (you are HERE): ${currentBranchInfo}

Other branches:
${otherBranchList}

New message: "${message}"

Decide:
- STAY: Message continues current topic (return STAY, no targetBranchId needed)
- ROUTE: Message belongs to a DIFFERENT existing branch (return ROUTE + targetBranchId of that other branch)
- BRANCH: Message is completely unrelated to ALL branches (return BRANCH + newBranchTopic)

IMPORTANT: If the message fits the current branch, return STAY. Only use ROUTE to switch to a different branch.

Quick checks:
- Filler (Yes, Ok, Sure, Thanks) → STAY
- Comparisons "[X] or [Y]?" → STAY
- "Now X", "What about X" → likely BRANCH or ROUTE
- Focus on primary intent, ignore incidental mentions`;
}
