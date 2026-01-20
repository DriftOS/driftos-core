# Frontend Changes Required for Stateful Demo

## Summary

The backend has been updated to support incremental/stateful processing. Only **ONE LINE** needs to change in the frontend.

## Changes Made to Backend

✅ **driftos-core** backend now:
1. Accepts `conversationId` as a required field in `/demo/route` request
2. Caches conversation state in memory
3. Only processes NEW messages (incremental processing)
4. Uses deterministic branch IDs based on conversationId
5. Returns `lastProcessedIndex` in state

## Frontend Change Required

**File**: `driftos-demo/src/hooks/useDemoMode.ts`

**Line**: ~190 (in the `streamDemoChat` function)

### Current Code:
```typescript
const routeResponse = await fetch(`${apiUrl}/demo/route`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: conversation,  // ← Missing conversationId
  }),
});
```

### Updated Code:
```typescript
const routeResponse = await fetch(`${apiUrl}/demo/route`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: currentConversationId,  // ← ADD THIS LINE
    messages: conversation,
  }),
});
```

## That's It!

The `currentConversationId` already exists in the component state, so you just need to pass it to the backend.

## What This Fixes

### Before (Broken):
- Every request re-processes ALL messages from scratch
- Branch IDs change on every request (random timestamps)
- Topics get renamed randomly
- UI jumps around
- Token usage grows quadratically (1+2+3+4+5... messages = wasted LLM calls)
- Terrible user experience

### After (Fixed):
- ✅ Only NEW messages are processed
- ✅ Branch IDs stay consistent across requests
- ✅ Topics never change after creation
- ✅ UI is stable and predictable
- ✅ Token usage is linear (5 messages = 5 LLM calls, not 15)
- ✅ Much faster responses
- ✅ Great user experience

## How It Works

### Request 1: User sends "I want to buy a house"
```json
{
  "conversationId": "conv-123",
  "messages": [
    { "role": "user", "content": "I want to buy a house" }
  ]
}
```
**Backend**:
- No cached state found
- Processes 1 message → 1 LLM call
- Creates branch: `conv-123-branch-0` with topic "house buying"
- Caches state with `lastProcessedIndex: 1`

### Request 2: User sends "What areas have good schools?"
```json
{
  "conversationId": "conv-123",
  "messages": [
    { "role": "user", "content": "I want to buy a house" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "What areas have good schools?" }
  ]
}
```
**Backend**:
- Cached state found with `lastProcessedIndex: 1`
- Only processes messages[1:] (last 2 messages) → 2 LLM calls
- Reuses existing branch `conv-123-branch-0`
- Decides: STAY (schools related to house buying)
- Updates cache with `lastProcessedIndex: 3`

### Request 3: User sends "I'm going to have a chicken burger"
```json
{
  "conversationId": "conv-123",
  "messages": [
    { "role": "user", "content": "I want to buy a house" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "What areas have good schools?" },
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "I'm going to have a chicken burger" }
  ]
}
```
**Backend**:
- Cached state found with `lastProcessedIndex: 3`
- Only processes messages[3:] (last 2 messages) → 2 LLM calls
- Decides: BRANCH (food is unrelated to house buying)
- Creates NEW branch: `conv-123-branch-1` with topic "food"
- Updates cache with `lastProcessedIndex: 5`

## Benefits

**Token Savings Example** (5 user messages):

| Request | Old Behavior | New Behavior | Savings |
|---------|--------------|--------------|---------|
| 1st msg | 1 LLM call  | 1 LLM call   | 0%      |
| 2nd msg | 2 LLM calls | 1 LLM call   | 50%     |
| 3rd msg | 3 LLM calls | 1 LLM call   | 67%     |
| 4th msg | 4 LLM calls | 1 LLM call   | 75%     |
| 5th msg | 5 LLM calls | 1 LLM call   | 80%     |
| **Total** | **15 calls** | **5 calls** | **67% savings** |

**For a 10-message conversation**: 55 calls → 10 calls = **82% token savings**

## Testing

After making the frontend change, test with these scenarios:

1. **Branch Stability Test**:
   - Send: "I want to buy a house in London"
   - Send: "What areas have good schools?"
   - **Verify**: Both messages in same branch with ID like `conv-xxx-branch-0`
   - **Verify**: Topic stays "house buying" (or similar)

2. **Topic Shift Test**:
   - Continue from above
   - Send: "I'm going to have a chicken burger"
   - **Verify**: New branch created `conv-xxx-branch-1` with topic "food"
   - **Verify**: Previous branch unchanged

3. **UI Stability Test**:
   - Have a multi-turn conversation
   - **Verify**: No jumping between branches
   - **Verify**: Branch names don't change
   - **Verify**: Routing decisions are consistent

4. **Performance Test**:
   - Check browser network tab
   - **Verify**: Response times get faster (no re-processing)
   - **Verify**: Token usage in response headers is reasonable

## Impact on embed-enterprise

✅ **NO IMPACT** - embed-enterprise has its own independent demo implementation.

Changes are isolated to driftos-core only.
