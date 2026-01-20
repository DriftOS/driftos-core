-- MIGRATION: Add composite primary key (userId, id) for user-scoped conversations
-- This allows multiple users to use the same conversationId (e.g., 'conv-123') without conflicts

-- ============================================================================
-- Step 1: Add userId columns to child tables (nullable first for backfill)
-- ============================================================================

-- Add userId to branches table
ALTER TABLE "branches" ADD COLUMN "userId" TEXT;

-- Add userId to messages table
ALTER TABLE "messages" ADD COLUMN "userId" TEXT;

-- Add userId to clusters table
ALTER TABLE "clusters" ADD COLUMN "userId" TEXT;

-- ============================================================================
-- Step 2: Backfill userId from parent conversation
-- ============================================================================

-- Backfill branches.userId from conversations
UPDATE "branches"
SET "userId" = c."userId"
FROM "conversations" c
WHERE "branches"."conversationId" = c.id;

-- Backfill messages.userId from conversations
UPDATE "messages"
SET "userId" = m_conv."userId"
FROM "conversations" m_conv
WHERE "messages"."conversationId" = m_conv.id;

-- Backfill clusters.userId from conversations
UPDATE "clusters"
SET "userId" = cl_conv."userId"
FROM "conversations" cl_conv
WHERE "clusters"."conversationId" = cl_conv.id;

-- ============================================================================
-- Step 3: Make userId NOT NULL and update foreign keys
-- ============================================================================

-- Make branches.userId NOT NULL
ALTER TABLE "branches" ALTER COLUMN "userId" SET NOT NULL;

-- Make messages.userId NOT NULL
ALTER TABLE "messages" ALTER COLUMN "userId" SET NOT NULL;

-- Make clusters.userId NOT NULL
ALTER TABLE "clusters" ALTER COLUMN "userId" SET NOT NULL;

-- Make conversations.userId NOT NULL (was nullable before)
ALTER TABLE "conversations" ALTER COLUMN "userId" SET NOT NULL;

-- ============================================================================
-- Step 4: Drop old foreign keys
-- ============================================================================

-- Drop old conversation foreign key from branches
ALTER TABLE "branches" DROP CONSTRAINT IF EXISTS "branches_conversationId_fkey";

-- Drop old conversation foreign key from messages
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_conversationId_fkey";

-- Drop old conversation foreign key from clusters
ALTER TABLE "clusters" DROP CONSTRAINT IF EXISTS "clusters_conversationId_fkey";

-- ============================================================================
-- Step 5: Update conversations primary key to composite
-- ============================================================================

-- Drop old primary key on conversations
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_pkey";

-- Add new composite primary key (userId, id)
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("userId", "id");

-- ============================================================================
-- Step 6: Add new composite foreign keys
-- ============================================================================

-- Add composite foreign key from branches to conversations
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_userId_conversationId_fkey"
  FOREIGN KEY ("userId", "conversationId")
  REFERENCES "conversations"("userId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Add composite foreign key from messages to conversations
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_userId_conversationId_fkey"
  FOREIGN KEY ("userId", "conversationId")
  REFERENCES "conversations"("userId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- Add composite foreign key from clusters to conversations
ALTER TABLE "clusters"
  ADD CONSTRAINT "clusters_userId_conversationId_fkey"
  FOREIGN KEY ("userId", "conversationId")
  REFERENCES "conversations"("userId", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ============================================================================
-- Step 7: Update indexes
-- ============================================================================

-- Drop old conversationId indexes
DROP INDEX IF EXISTS "branches_conversationId_idx";
DROP INDEX IF EXISTS "messages_conversationId_idx";
DROP INDEX IF EXISTS "clusters_conversationId_idx";

-- Create new composite indexes
CREATE INDEX "branches_userId_conversationId_idx" ON "branches"("userId", "conversationId");
CREATE INDEX "messages_userId_conversationId_idx" ON "messages"("userId", "conversationId");
CREATE INDEX "clusters_userId_conversationId_idx" ON "clusters"("userId", "conversationId");
