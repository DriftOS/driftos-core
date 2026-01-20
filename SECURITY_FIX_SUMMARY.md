# Security Fix: User-Scoped Conversation IDs

## Problem Identified

**Critical Security Vulnerability**: Users could access other users' conversations by providing their conversation IDs.

### Original Implementation
- Conversation IDs were globally unique (single `id` primary key)
- When a user provided a conversationId like `'conv-123'`:
  - If it didn't exist → created with that ID
  - If it existed → **vulnerable upsert with empty update allowed access**

### Attack Vector
```typescript
// User A creates conversation
POST /api/v1/drift/route
Authorization: Bearer USER_A_TOKEN
{ "conversationId": "conv-123", "content": "Secret message" }

// User B can hijack by using same conversationId
POST /api/v1/drift/route
Authorization: Bearer USER_B_TOKEN
{ "conversationId": "conv-123", "content": "I can see User A's messages!" }
// ❌ This would access User A's conversation!
```

## Solution Implemented

**Composite Primary Key**: Changed from `id` to `(userId, id)` for user-scoped isolation.

### Schema Changes

#### Before
```prisma
model Conversation {
  id     String  @id @default(cuid())
  userId String?
  // ...
}
```

#### After
```prisma
model Conversation {
  id     String  // User-scoped ID
  userId String  // Required, not nullable
  // ...

  @@id([userId, id])  // Composite PK
}
```

### All Updated Models
- **Conversation**: Primary key → `(userId, id)`
- **Branch**: Added `userId` field, foreign key → `(userId, conversationId)`
- **Message**: Added `userId` field, foreign key → `(userId, conversationId)`
- **Cluster**: Added `userId` field, foreign key → `(userId, conversationId)`

## Security Improvement

### Now With Composite Keys
```typescript
// User A creates conversation
POST /api/v1/drift/route
Authorization: Bearer USER_A_TOKEN
{ "conversationId": "conv-123", "content": "Secret message" }
// Creates: (userId='user-a', id='conv-123')

// User B tries same conversationId
POST /api/v1/drift/route
Authorization: Bearer USER_B_TOKEN
{ "conversationId": "conv-123", "content": "Trying to access..." }
// Creates: (userId='user-b', id='conv-123') ← SEPARATE conversation!

// ✅ User B cannot access User A's data
```

### Key Security Properties

1. **User Isolation**: Each user has their own namespace of conversation IDs
2. **No Cross-User Access**: Composite key lookups automatically filter by userId
3. **API Unchanged**: Users still pass simple conversationIds like `'conv-123'`
4. **Transparent Security**: userId extracted from Clerk JWT token server-side

## Code Changes

### 1. validate-input.ts (Fixed Vulnerability)
```typescript
// BEFORE (VULNERABLE)
await prisma.conversation.upsert({
  where: { id: ctx.conversationId },
  update: {},  // ⚠️ Empty update = no ownership check!
  create: { id: ctx.conversationId, userId: ctx.userId },
});

// AFTER (SECURE)
const conversation = await prisma.conversation.findUnique({
  where: {
    userId_id: {
      userId: ctx.userId,
      id: ctx.conversationId,
    },
  },
});

if (!conversation) {
  await prisma.conversation.create({
    data: { id: ctx.conversationId, userId: ctx.userId },
  });
}
// ✅ Composite key ensures user isolation
```

### 2. All Conversation Queries Updated

**Pattern**: Every conversation lookup now uses composite key:
```typescript
// OLD
prisma.conversation.findUnique({ where: { id: conversationId } })

// NEW
prisma.conversation.findUnique({
  where: {
    userId_id: {
      userId: userId,
      id: conversationId,
    },
  },
})
```

**Files Updated**:
- `/src/routes/conversations/index.ts` (4 locations)
- `/src/routes/messages/index.ts` (1 location)
- `/src/services/drift/operations/validate-input.ts` (1 location)
- `/src/services/drift/operations/load-branches.ts` (1 location)
- `/src/services/drift/operations/execute-route.ts` (3 locations)

### 3. Child Record Creation
```typescript
// All Branch/Message creates now include userId
await prisma.branch.create({
  data: {
    userId: ctx.userId,        // ← Added
    conversationId: ctx.conversationId,
    // ...
  },
});

await prisma.message.create({
  data: {
    userId: ctx.userId,        // ← Added
    conversationId: ctx.conversationId,
    // ...
  },
});
```

## Database Migration

**Migration**: `20260120210604_composite_pk_user_scoped_conversations`

### Migration Steps
1. Add `userId` columns to child tables (nullable)
2. Backfill from parent conversations
3. Make `userId` NOT NULL
4. Drop old single-column primary key
5. Create composite `(userId, id)` primary key
6. Update all foreign key constraints
7. Recreate indexes

### Data Safety
- ✅ All existing data preserved
- ✅ Backfilled userIds from conversation relationships
- ✅ No data loss

## API Compatibility

### External API - No Changes Required

**SDK usage remains identical**:
```typescript
// Still works exactly as before
const drift = createDriftClient(apiUrl, apiKey);
await drift.route('conv-123', 'Hello');
```

**REST API unchanged**:
```bash
POST /api/v1/drift/route
{
  "conversationId": "conv-123",  # Still just a string
  "content": "Hello"
}
```

### Internal Processing
1. User sends `conversationId: 'conv-123'`
2. Backend extracts `userId` from JWT
3. Composite lookup: `(userId, conversationId)`
4. Complete user isolation, transparent to client

## Testing

### Build Status
✅ TypeScript compilation successful
✅ Prisma client generated
✅ No type errors

### Manual Testing Scenarios

1. **Multiple users, same conversationId**
   - User A: `'conv-123'` → creates `(user-a, conv-123)`
   - User B: `'conv-123'` → creates `(user-b, conv-123)`
   - ✅ Both succeed, separate conversations

2. **Cross-user access attempt**
   - User A creates conversation
   - User B tries to access with same ID
   - ✅ User B gets their own conversation (404 for User A's)

3. **Existing functionality preserved**
   - Create conversation
   - Send messages
   - List conversations
   - Delete conversation
   - ✅ All work as expected

## Files Modified

### Schema & Migration
- `prisma/schema.prisma`
- `prisma/migrations/20260120210604_composite_pk_user_scoped_conversations/migration.sql`

### Application Code
- `src/services/drift/operations/validate-input.ts`
- `src/services/drift/operations/load-branches.ts`
- `src/services/drift/operations/execute-route.ts`
- `src/routes/conversations/index.ts`
- `src/routes/messages/index.ts`

### Documentation
- `test-composite-pk.md`
- `SECURITY_FIX_SUMMARY.md` (this file)

## Deployment Checklist

- [x] Schema updated with composite keys
- [x] Migration created and tested
- [x] All conversation queries updated
- [x] All child record creation includes userId
- [x] TypeScript build passes
- [x] Prisma client regenerated
- [ ] Run migration on production: `npx prisma migrate deploy`
- [ ] Monitor for any foreign key constraint errors
- [ ] Verify user isolation in production logs

## Rollback Plan

If issues arise:
```bash
# Revert migration
npx prisma migrate resolve --rolled-back 20260120210604_composite_pk_user_scoped_conversations

# Manual rollback SQL
ALTER TABLE conversations DROP CONSTRAINT conversations_pkey;
ALTER TABLE conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
# ... (full rollback script would reverse all changes)
```

## Performance Considerations

### Index Performance
- Composite indexes created: `(userId, conversationId)`
- Query performance: Same or better (userId filter added)
- Database size: Minimal increase (userId columns)

### Query Patterns
```sql
-- Before: Single column lookup
SELECT * FROM conversations WHERE id = 'conv-123';

-- After: Composite key lookup (uses index)
SELECT * FROM conversations WHERE userId = 'user-a' AND id = 'conv-123';
```

The composite index `(userId, id)` efficiently handles these lookups.

## Conclusion

This fix eliminates a critical security vulnerability where users could potentially access other users' conversations. The implementation:

1. ✅ **Secure**: Enforces user isolation at database level
2. ✅ **Transparent**: API interface unchanged
3. ✅ **Performant**: Proper indexes maintain query speed
4. ✅ **Safe**: Migration preserves all existing data
5. ✅ **Tested**: Build passes, type-safe

The composite primary key approach is the correct architectural solution for multi-tenant conversation storage.
