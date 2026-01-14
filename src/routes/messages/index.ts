import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { driftService } from '../../services/drift';

/**
 * Message Routes
 *
 * POST /messages - Send message with drift routing
 */
const messageRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Send message with drift routing
  fastify.post(
    '/',
    {
      schema: {
        description: 'Send a message with automatic drift-based routing',
        tags: ['Messages'],
        body: Type.Object({
          conversationId: Type.String(),
          content: Type.String(),
          role: Type.Optional(
            Type.Union([Type.Literal('user'), Type.Literal('assistant')], {
              default: 'user',
            })
          ),
          currentBranchId: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              messageId: Type.String(),
              branchId: Type.String(),
              conversationId: Type.String(),
              action: Type.Union([
                Type.Literal('STAY'),
                Type.Literal('ROUTE'),
                Type.Literal('BRANCH'),
              ]),
              driftAction: Type.Union([
                Type.Literal('STAY'),
                Type.Literal('BRANCH_SAME_CLUSTER'),
                Type.Literal('BRANCH_NEW_CLUSTER'),
              ]),
              isNewBranch: Type.Boolean(),
              isNewCluster: Type.Boolean(),
              branchTopic: Type.Optional(Type.String()),
              similarity: Type.Number(),
              confidence: Type.Number(),
              reason: Type.String(),
              metadata: Type.Optional(Type.Any()),
            }),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
          403: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
          404: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { conversationId, content, role = 'user', currentBranchId } = request.body;

      // Verify conversation exists and check ownership
      const conversation = await fastify.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });

      if (!conversation) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Conversation not found' },
        });
      }

      if (conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this conversation' },
        });
      }

      // Get optional routing model override from headers
      const routingModel = request.headers['x-routing-model'] as string | undefined;
      const routingProvider = request.headers['x-routing-provider'] as 'groq' | 'openai' | 'anthropic' | undefined;

      // Route message through drift service
      const result = await driftService.route(conversationId, content, {
        role,
        currentBranchId,
        routingModel,
        routingProvider,
      });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Failed to route message' },
        });
      }

      const data = result.data!;

      return reply.send({
        success: true,
        data: {
          messageId: data.messageId,
          branchId: data.branchId,
          conversationId,
          action: data.action,
          driftAction: data.driftAction,
          isNewBranch: data.isNewBranch,
          isNewCluster: data.isNewCluster,
          branchTopic: data.branchTopic,
          similarity: data.similarity,
          confidence: data.confidence,
          reason: data.reason,
          metadata: data.metadata,
        },
      });
    }
  );
};

export default messageRoutes;
