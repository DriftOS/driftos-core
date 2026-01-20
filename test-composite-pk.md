# Composite Primary Key - User-Scoped Conversations

## What Changed

### Schema Changes
- **Conversation table**: Primary key changed from `id` to composite `(userId, id)`
- **Child tables** (Branch, Message, Cluster): Added `userId` column
- **Foreign keys**: Updated to use composite keys `(userId, conversationId)`

### Security Improvement
Previously, conversation IDs were globally unique. If User A created conversation `'conv-123'`, User B could not create a conversation with the same ID.

**More importantly**: User B could potentially access User A's conversation by providing that ID (the vulnerability we fixed).

Now, conversation IDs are **user-scoped**:
- User A can create conversation `'conv-123'`
- User B can also create conversation `'conv-123'`
- These are completely separate conversations in the database
- Users cannot access each other's conversations even if they know the ID

## API/SDK Interface - Unchanged

The external API remains exactly the same. Users continue to pass `conversationId` as before:

### SDK Usage (No Changes Required)
```typescript
import { createDriftClient } from '@driftos/client';

const drift = createDriftClient(
  'https://api.driftos.dev/api/v1/embed',
  'YOUR_API_KEY'
);

// Still works exactly the same - user can choose any conversationId
const result = await drift.route('conv-123', 'I want to plan a trip to Paris');
```

### REST API (No Changes Required)
```bash
# POST /api/v1/drift/route
curl -X POST https://api.driftos.dev/api/v1/drift/route \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-123",
    "content": "I want to plan a trip to Paris"
  }'
```

## How It Works Internally

1. **User sends request** with `conversationId: 'conv-123'`
2. **Backend extracts userId** from Clerk JWT token
3. **Composite key lookup**: `WHERE userId = 'user-abc' AND id = 'conv-123'`
4. **If conversation doesn't exist**: Create it with `(userId: 'user-abc', id: 'conv-123')`
5. **If conversation exists**:
   - If it belongs to this user → allow access
   - If it belongs to another user → returns 404 (can't find because composite key doesn't match)

## Testing

### Test Case 1: Same conversationId, different users
```bash
# User A creates conversation 'conv-123'
curl -X POST ... -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"conversationId": "conv-123", "content": "Hello from User A"}'

# User B creates conversation 'conv-123' (separate conversation)
curl -X POST ... -H "Authorization: Bearer $USER_B_TOKEN" \
  -d '{"conversationId": "conv-123", "content": "Hello from User B"}'

# Both succeed - creates two separate conversations:
# - (userId='user-a', id='conv-123')
# - (userId='user-b', id='conv-123')
```

### Test Case 2: Cross-user access attempt (security)
```bash
# User A sends message to their conversation
curl -X POST ... -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"conversationId": "conv-123", "content": "First message"}'

# User B tries to access User A's conversation (should fail)
curl -X POST ... -H "Authorization: Bearer $USER_B_TOKEN" \
  -d '{"conversationId": "conv-123", "content": "Trying to hijack"}'

# Result: Creates NEW conversation for User B
# - User A's conversation: (userId='user-a', id='conv-123') ← unchanged
# - User B's conversation: (userId='user-b', id='conv-123') ← new, separate
```

## Migration Details

The migration handles existing data safely:
1. Adds `userId` columns (nullable first)
2. Backfills from parent conversations
3. Makes columns NOT NULL
4. Drops old PK, creates composite PK
5. Updates all foreign keys and indexes

All existing conversations are preserved with their current userIds.
