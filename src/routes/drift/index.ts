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
      const { conversationId, content, role, currentBranchId, extractFacts } = request.body;

      // Get optional routing model override from headers
      const routingModel = request.headers['x-routing-model'] as string | undefined;
      const routingProvider = request.headers['x-routing-provider'] as 'groq' | 'openai' | 'anthropic' | undefined;

      const result = await driftService.route(conversationId, content, {
        role,
        currentBranchId,
        userId: request.userId,
        clientIp: request.ip,
        routingModel,
        routingProvider,
        extractFacts: extractFacts ?? false, // Default to routing-only mode
      });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Routing failed' },
        });
      }

      // Add token usage to response headers for gateway tracking
      if (result.data?.metadata?.tokenUsage) {
        reply.header('X-Token-Input', result.data.metadata.tokenUsage.inputTokens.toString());
        reply.header('X-Token-Output', result.data.metadata.tokenUsage.outputTokens.toString());
        reply.header('X-Token-Total', result.data.metadata.tokenUsage.totalTokens.toString());
      }
      if (result.data?.metadata?.llmModel) {
        reply.header('X-LLM-Model', result.data.metadata.llmModel);
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
