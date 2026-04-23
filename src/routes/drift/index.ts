import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { driftService } from '@services/drift';

const driftRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Route a message
  fastify.post(
    '/route',
    {
      schema: {
        description: 'Route a message to the appropriate branch',
        tags: ['Drift'],
        body: Type.Object({
          conversationId: Type.String(),
          content: Type.String(),
          role: Type.Optional(Type.Union([Type.Literal('user'), Type.Literal('assistant')])),
          currentBranchId: Type.Optional(Type.String()),
          extractFacts: Type.Optional(Type.Boolean()), // Optional: extract facts during routing (default: false)
          // User-controlled branch targeting. PINNED skips LLM routing and forces the
          // message onto targetBranchId (which must belong to this conversation).
          branchMode: Type.Optional(
            Type.Union([Type.Literal('AUTO'), Type.Literal('PINNED')])
          ),
          targetBranchId: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              action: Type.Union([
                Type.Literal('STAY'),
                Type.Literal('ROUTE'),
                Type.Literal('BRANCH'),
              ]),
              branchId: Type.String(),
              messageId: Type.String(),
              previousBranchId: Type.Optional(Type.String()),
              isNewBranch: Type.Boolean(),
              isNewCluster: Type.Boolean(),
              reason: Type.String(),
              branchTopic: Type.Optional(Type.String()),
              confidence: Type.Number(),
              similarity: Type.Number(),
              driftAction: Type.Union([
                Type.Literal('STAY'),
                Type.Literal('BRANCH_SAME_CLUSTER'),
                Type.Literal('BRANCH_NEW_CLUSTER'),
              ]),
              metadata: Type.Optional(Type.Any()),
            }),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const {
        conversationId,
        content,
        role,
        currentBranchId,
        extractFacts,
        branchMode,
        targetBranchId,
      } = request.body;

      if (branchMode === 'PINNED' && !targetBranchId) {
        return reply.status(400).send({
          success: false,
          error: { message: 'targetBranchId is required when branchMode is PINNED' },
        });
      }

      // Get optional routing model override from headers
      const routingModel = request.headers['x-routing-model'] as string | undefined;
      const routingProvider = request.headers['x-routing-provider'] as
        | 'groq'
        | 'openai'
        | 'anthropic'
        | undefined;

      // DEBUG: Log userId and headers
      fastify.log.info(
        {
          userId: request.userId,
          xUserId: request.headers['x-user-id'],
          allHeaders: request.headers,
        },
        'POST /drift/route - userId debug'
      );

      const result = await driftService.route(conversationId, content, {
        role,
        currentBranchId,
        userId: request.userId,
        clientIp: request.ip,
        routingModel,
        routingProvider,
        extractFacts: extractFacts ?? false, // Default to routing-only mode
        branchMode,
        targetBranchId,
      });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Routing failed' },
        });
      }

      // Add token usage to response headers for gateway tracking
      if (result.data?.metadata?.tokenUsage) {
        void reply.header('X-Token-Input', result.data.metadata.tokenUsage.inputTokens.toString());
        void reply.header(
          'X-Token-Output',
          result.data.metadata.tokenUsage.outputTokens.toString()
        );
        void reply.header('X-Token-Total', result.data.metadata.tokenUsage.totalTokens.toString());
      }
      if (result.data?.metadata?.llmModel) {
        void reply.header('X-LLM-Model', result.data.metadata.llmModel);
      }

      return reply.send({
        success: true,
        data: result.data!,
      });
    }
  );
  // List branches for a conversation
  fastify.get(
    '/branches/:conversationId',
    {
      schema: {
        description: 'List all branches for a conversation',
        tags: ['Drift'],
        params: Type.Object({
          conversationId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                topic: Type.String(),
                messageCount: Type.Number(),
                factCount: Type.Number(),
                parentId: Type.Optional(Type.String()),
                createdAt: Type.String(),
                updatedAt: Type.String(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;

      // Verify conversation exists and belongs to user
      const conversation = await fastify.prisma.conversation.findUnique({
        where: {
          userId_id: {
            userId: request.userId ?? '',
            id: conversationId,
          },
        },
        select: { userId: true },
      });

      // If conversation doesn't exist, return empty branches array (new conversation)
      if (!conversation) {
        return reply.send({
          success: true,
          data: [],
        });
      }

      // Check ownership
      if (conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this conversation' },
        });
      }

      const branches = await fastify.prisma.branch.findMany({
        where: {
          userId: request.userId ?? '',
          conversationId,
        },
        include: {
          _count: {
            select: { messages: true, facts: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: branches.map((b) => ({
          id: b.id,
          topic: b.summary ?? 'Unknown',
          messageCount: b._count.messages,
          factCount: b._count.facts,
          parentId: b.parentId ?? undefined,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        })),
      });
    }
  );

  // Delete a conversation and everything belonging to it
  fastify.delete(
    '/conversations/:conversationId',
    {
      schema: {
        description:
          'Delete a conversation and all of its branches, messages, and facts. Use this to implement client "Clear history" flows. Returns 404 when the conversation does not exist (or belongs to another user).',
        tags: ['Drift'],
        params: Type.Object({
          conversationId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              deletedBranches: Type.Number(),
              deletedMessages: Type.Number(),
              deletedFacts: Type.Number(),
            }),
          }),
          404: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;
      const userId = request.userId ?? '';

      const conversation = await fastify.prisma.conversation.findUnique({
        where: { userId_id: { userId, id: conversationId } },
        select: { id: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Conversation not found' },
        });
      }

      // Count what's about to go so we can report it back
      const [deletedBranches, deletedMessages, deletedFacts] = await Promise.all([
        fastify.prisma.branch.count({ where: { userId, conversationId } }),
        fastify.prisma.message.count({ where: { userId, conversationId } }),
        fastify.prisma.fact.count({
          where: { branch: { userId, conversationId } },
        }),
      ]);

      // Atomic cascade. Prisma cascades Conversation -> Branches/Clusters/Messages
      // and Branch -> Facts/ClusterMemberships/TailRoutes/MergeEdges. TailRoutes
      // anchored to these messages (anchorMessageId has no cascade) are cleared
      // explicitly; DriftLog has no FK and is cleaned by conversationId.
      await fastify.prisma.$transaction(async (tx) => {
        const msgs = await tx.message.findMany({
          where: { userId, conversationId },
          select: { id: true },
        });
        const messageIds = msgs.map((m) => m.id);
        if (messageIds.length > 0) {
          await tx.tailRoute.deleteMany({
            where: { anchorMessageId: { in: messageIds } },
          });
        }
        await tx.driftLog.deleteMany({ where: { conversationId } });
        await tx.conversation.delete({
          where: { userId_id: { userId, id: conversationId } },
        });
      });

      return reply.send({
        success: true,
        data: { deletedBranches, deletedMessages, deletedFacts },
      });
    }
  );

  // Delete a single branch. Children cascade: deleting a branch also deletes
  // every descendant branch plus their messages and facts. Document this
  // behaviour in the SDK / API reference.
  fastify.delete(
    '/branches/:branchId',
    {
      schema: {
        description:
          'Delete a branch and every descendant branch (cascading), including their messages and facts. Returns 404 when the branch does not exist or belongs to another user.',
        tags: ['Drift'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              deletedMessages: Type.Number(),
              deletedFacts: Type.Number(),
            }),
          }),
          404: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { branchId } = request.params;
      const userId = request.userId ?? '';

      const branch = await fastify.prisma.branch.findUnique({
        where: { id: branchId },
        select: { userId: true },
      });

      // 404 covers both "does not exist" and "belongs to someone else" to avoid
      // leaking branch ID existence across tenants.
      if (!branch || branch.userId !== userId) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Branch not found' },
        });
      }

      // Walk the subtree rooted at branchId via recursive CTE, scoped to user.
      const rows = await fastify.prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE branch_tree AS (
          SELECT id FROM branches WHERE id = ${branchId} AND "userId" = ${userId}
          UNION
          SELECT b.id FROM branches b
          INNER JOIN branch_tree bt ON b."parentId" = bt.id
          WHERE b."userId" = ${userId}
        )
        SELECT id FROM branch_tree;
      `;
      const branchIds = rows.map((r) => r.id);

      const [deletedMessages, deletedFacts] = await Promise.all([
        fastify.prisma.message.count({ where: { branchId: { in: branchIds } } }),
        fastify.prisma.fact.count({ where: { branchId: { in: branchIds } } }),
      ]);

      await fastify.prisma.$transaction(async (tx) => {
        const msgs = await tx.message.findMany({
          where: { branchId: { in: branchIds } },
          select: { id: true },
        });
        const messageIds = msgs.map((m) => m.id);
        if (messageIds.length > 0) {
          await tx.tailRoute.deleteMany({
            where: { anchorMessageId: { in: messageIds } },
          });
        }
        await tx.branch.deleteMany({ where: { id: { in: branchIds } } });
      });

      return reply.send({
        success: true,
        data: { deletedMessages, deletedFacts },
      });
    }
  );

  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check if Drift service is healthy',
        tags: ['Drift'],
        response: {
          200: Type.Object({
            status: Type.String(),
            service: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const health = await driftService.healthCheck();
      return reply.send(health);
    }
  );

  // Satisfy async requirement
  await Promise.resolve();
};

export default driftRoutes;
