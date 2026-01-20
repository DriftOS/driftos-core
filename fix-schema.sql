-- Fix missing schema columns in production database
-- Applied via flyctl ssh console commands on 2026-01-14

-- This file documents all the schema fixes that were applied manually
-- because Prisma migrations were not running correctly

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS "conversations_userId_idx" ON conversations("userId");
CREATE INDEX IF NOT EXISTS "conversations_active_idx" ON conversations(active);

-- ============================================================================
-- BRANCHES TABLE
-- ============================================================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "branchDepth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "driftType" TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "fpodMessageId" TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "xpodMessageId" TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "semanticDriftScore" DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "functionalDriftScore" DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS "driftMetadata" JSONB;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS "branches_status_idx" ON branches(status);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "driftAction" TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "driftReason" TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "driftMetadata" JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "preprocessedContent" TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "preprocessedEmbedding" DOUBLE PRECISION[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "semanticDrift" DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "functionalDrift" DOUBLE PRECISION;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these to verify all columns exist:

SELECT 'Conversations:' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('userId', 'active', 'topic', 'metadata')
ORDER BY column_name;

SELECT 'Branches:' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'branches'
  AND column_name IN ('branchDepth', 'status', 'driftType', 'fpodMessageId', 'xpodMessageId', 'semanticDriftScore', 'functionalDriftScore', 'driftMetadata', 'metadata')
ORDER BY column_name;

SELECT 'Messages:' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'messages'
  AND column_name IN ('driftAction', 'driftReason', 'driftMetadata', 'preprocessedContent', 'preprocessedEmbedding', 'semanticDrift', 'functionalDrift', 'metadata')
ORDER BY column_name;
