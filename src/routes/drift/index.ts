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
              reason: Type.String(),
              branchTopic: Type.Optional(Type.String()),
              confidence: Type.Number(),
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
      const { conversationId, content, role, currentBranchId } = request.body;

      const result = await driftService.route(conversationId, content, {
        role,
        currentBranchId,
        userId: request.userId,
        clientIp: request.ip,
      });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Routing failed' },
        });
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
          id: conversationId,
        },
        select: { userId: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Conversation not found' },
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
        where: { conversationId },
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
};

export default driftRoutes;
