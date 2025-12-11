import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

/**
 * Conversations Routes
 *
 * GET  /conversations              - List conversations by prefix
 * GET  /conversations/:id          - Get conversation summary
 * GET  /conversations/:id/branches - List all branches
 */
const conversationsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // List conversations by prefix (for device-based filtering)
  fastify.get(
    '/',
    {
      schema: {
        description: 'List conversations filtered by ID prefix (for device-based access)',
        tags: ['Conversations'],
        querystring: Type.Object({
          prefix: Type.String({ description: 'Conversation ID prefix to filter by' }),
          limit: Type.Optional(Type.Number({ default: 50, maximum: 100 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                title: Type.String(),
                messageCount: Type.Number(),
                branchCount: Type.Number(),
                createdAt: Type.String(),
                updatedAt: Type.String(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { prefix, limit = 50 } = request.query;

      // Find conversations with matching prefix
      const conversations = await fastify.prisma.conversation.findMany({
        where: {
          id: { startsWith: prefix },
        },
        include: {
          _count: { select: { branches: true } },
          branches: {
            include: {
              messages: {
                take: 1,
                orderBy: { createdAt: 'asc' },
                select: { content: true },
              },
              _count: { select: { messages: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      return reply.send({
        success: true,
        data: conversations.map((c) => {
          // Get first message from first branch for title
          const firstMessage = c.branches[0]?.messages[0]?.content;
          // Sum message counts across all branches
          const messageCount = c.branches.reduce((sum, b) => sum + b._count.messages, 0);
          return {
            id: c.id,
            title: firstMessage?.slice(0, 50) || 'New Chat',
            messageCount,
            branchCount: c._count.branches,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          };
        }),
      });
    }
  );

  // Get conversation summary
  fastify.get(
    '/:conversationId',
    {
      schema: {
        description: 'Get conversation summary with branch count and message stats',
        tags: ['Conversations'],
        params: Type.Object({
          conversationId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              id: Type.String(),
              branchCount: Type.Number(),
              messageCount: Type.Number(),
              currentBranchId: Type.Optional(Type.String()),
              createdAt: Type.String(),
              updatedAt: Type.String(),
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

      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          _count: { select: { branches: true } },
          branches: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Conversation not found' },
        });
      }

      // Count messages across all branches
      const messageCount = await fastify.prisma.message.count({
        where: { branch: { conversationId } },
      });

      return reply.send({
        success: true,
        data: {
          id: conversation.id,
          branchCount: conversation._count.branches,
          messageCount,
          currentBranchId: conversation.branches[0]?.id,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        },
      });
    }
  );

  // Get conversation context (all messages across branches)
  fastify.get(
    '/:conversationId/context',
    {
      schema: {
        description: 'Get conversation context with all messages',
        tags: ['Conversations'],
        params: Type.Object({
          conversationId: Type.String(),
        }),
        querystring: Type.Object({
          allBranches: Type.Optional(Type.Boolean({ default: false })),
          maxMessages: Type.Optional(Type.Number({ default: 200 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              conversationId: Type.String(),
              branchTopic: Type.String(),
              messages: Type.Array(
                Type.Object({
                  id: Type.String(),
                  role: Type.String(),
                  content: Type.String(),
                  branchId: Type.String(),
                  branchTopic: Type.Optional(Type.String()),
                  driftAction: Type.Optional(Type.String()),
                  driftReason: Type.Optional(Type.String()),
                  createdAt: Type.String(),
                })
              ),
              allFacts: Type.Array(
                Type.Object({
                  branchId: Type.String(),
                  branchTopic: Type.String(),
                  isCurrent: Type.Boolean(),
                  facts: Type.Array(Type.Any()),
                })
              ),
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
      const { allBranches, maxMessages = 200 } = request.query;

      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          branches: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: allBranches ? undefined : maxMessages,
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Conversation not found' },
        });
      }

      // Flatten messages from all branches if allBranches=true
      const messages = allBranches
        ? conversation.branches
            .flatMap((b) =>
              b.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                branchId: b.id,
                branchTopic: b.summary || undefined,
                driftAction: m.driftAction || undefined,
                driftReason: m.driftReason || undefined,
                createdAt: m.createdAt.toISOString(),
              }))
            )
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .slice(0, maxMessages)
        : (conversation.branches[0]?.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            branchId: conversation.branches[0]!.id,
            branchTopic: conversation.branches[0]!.summary || undefined,
            driftAction: m.driftAction || undefined,
            driftReason: m.driftReason || undefined,
            createdAt: m.createdAt.toISOString(),
          })) ?? []);

      const branchTopic = conversation.branches[0]?.summary || 'New conversation';

      return reply.send({
        success: true,
        data: {
          conversationId,
          branchTopic,
          messages,
          allFacts: conversation.branches.map((b) => ({
            branchId: b.id,
            branchTopic: b.summary || 'Unknown',
            isCurrent: b.id === conversation.branches[0]?.id,
            facts: [],
          })),
        },
      });
    }
  );

  // List branches for a conversation
  fastify.get(
    '/:conversationId/branches',
    {
      schema: {
        description: 'List all branches for a conversation',
        tags: ['Conversations'],
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

      const branches = await fastify.prisma.branch.findMany({
        where: { conversationId },
        include: {
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: branches.map((b) => ({
          id: b.id,
          topic: b.summary ?? 'Unknown',
          messageCount: b._count.messages,
          parentId: b.parentId ?? undefined,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        })),
      });
    }
  );
};

export default conversationsRoutes;
