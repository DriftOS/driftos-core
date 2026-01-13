/*
  Warnings:

  - You are about to drop the column `messageId` on the `facts` table. All the data in the column will be lost.
  - Added the required column `conversationId` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "branches" DROP CONSTRAINT "branches_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "facts" DROP CONSTRAINT "facts_branchId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_branchId_fkey";

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "branchDepth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "driftMetadata" JSONB,
ADD COLUMN     "driftType" TEXT,
ADD COLUMN     "fpodMessageId" TEXT,
ADD COLUMN     "functionalDriftScore" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "semanticDriftScore" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "xpodMessageId" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "topic" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "facts" DROP COLUMN "messageId",
ADD COLUMN     "messageIds" TEXT[];

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "driftMetadata" JSONB,
ADD COLUMN     "functionalDrift" DOUBLE PRECISION,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "preprocessedContent" TEXT,
ADD COLUMN     "preprocessedEmbedding" DOUBLE PRECISION[],
ADD COLUMN     "semanticDrift" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "clusters" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "centroid" DOUBLE PRECISION[],
    "health" TEXT NOT NULL DEFAULT 'healthy',
    "staleness" TEXT NOT NULL DEFAULT 'fresh',
    "capacity" INTEGER NOT NULL DEFAULT 100,
    "currentLoad" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cluster_memberships" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cluster_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tail_routes" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "anchorMessageId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tail_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_edges" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "anchorMessageId" TEXT,
    "reason" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merge_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drift_logs" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "semanticDrift" DOUBLE PRECISION NOT NULL,
    "functionalDrift" DOUBLE PRECISION NOT NULL,
    "action" TEXT NOT NULL,
    "branchTriggered" BOOLEAN NOT NULL DEFAULT false,
    "reasonCodes" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drift_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clusters_conversationId_idx" ON "clusters"("conversationId");

-- CreateIndex
CREATE INDEX "clusters_health_idx" ON "clusters"("health");

-- CreateIndex
CREATE INDEX "clusters_staleness_idx" ON "clusters"("staleness");

-- CreateIndex
CREATE INDEX "cluster_memberships_branchId_active_idx" ON "cluster_memberships"("branchId", "active");

-- CreateIndex
CREATE INDEX "cluster_memberships_clusterId_active_idx" ON "cluster_memberships"("clusterId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "cluster_memberships_branchId_clusterId_key" ON "cluster_memberships"("branchId", "clusterId");

-- CreateIndex
CREATE INDEX "tail_routes_branchId_idx" ON "tail_routes"("branchId");

-- CreateIndex
CREATE INDEX "tail_routes_targetId_idx" ON "tail_routes"("targetId");

-- CreateIndex
CREATE INDEX "tail_routes_status_idx" ON "tail_routes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tail_routes_branchId_targetId_anchorMessageId_key" ON "tail_routes"("branchId", "targetId", "anchorMessageId");

-- CreateIndex
CREATE INDEX "merge_edges_branchId_idx" ON "merge_edges"("branchId");

-- CreateIndex
CREATE INDEX "merge_edges_targetId_idx" ON "merge_edges"("targetId");

-- CreateIndex
CREATE INDEX "drift_logs_conversationId_idx" ON "drift_logs"("conversationId");

-- CreateIndex
CREATE INDEX "drift_logs_messageId_idx" ON "drift_logs"("messageId");

-- CreateIndex
CREATE INDEX "drift_logs_createdAt_idx" ON "drift_logs"("createdAt");

-- CreateIndex
CREATE INDEX "branches_status_idx" ON "branches"("status");

-- CreateIndex
CREATE INDEX "conversations_active_idx" ON "conversations"("active");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "facts_key_idx" ON "facts"("key");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- AddForeignKey
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_memberships" ADD CONSTRAINT "cluster_memberships_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cluster_memberships" ADD CONSTRAINT "cluster_memberships_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facts" ADD CONSTRAINT "facts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tail_routes" ADD CONSTRAINT "tail_routes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tail_routes" ADD CONSTRAINT "tail_routes_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tail_routes" ADD CONSTRAINT "tail_routes_anchorMessageId_fkey" FOREIGN KEY ("anchorMessageId") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_edges" ADD CONSTRAINT "merge_edges_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_edges" ADD CONSTRAINT "merge_edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_edges" ADD CONSTRAINT "merge_edges_anchorMessageId_fkey" FOREIGN KEY ("anchorMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
