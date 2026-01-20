const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSchema() {
  try {
    console.log('Checking and adding missing columns...');

    // Add userId column to conversations
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS "userId" TEXT
    `);
    console.log('✓ userId column added/verified');

    // Add active column to conversations
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true
    `);
    console.log('✓ active column added/verified');

    // Add topic column to conversations
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS topic TEXT
    `);
    console.log('✓ topic column added/verified');

    // Add metadata column to conversations
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS metadata JSONB
    `);
    console.log('✓ metadata column added/verified');

    // Add branchDepth column to branches
    await prisma.$executeRawUnsafe(`
      ALTER TABLE branches
      ADD COLUMN IF NOT EXISTS "branchDepth" INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✓ branchDepth column added/verified');

    // Create indexes if they don't exist
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "conversations_userId_idx" ON conversations("userId")
    `);
    console.log('✓ userId index created/verified');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "conversations_active_idx" ON conversations(active)
    `);
    console.log('✓ active index created/verified');

    console.log('\n✅ Schema fix completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixSchema();
