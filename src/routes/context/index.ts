import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { contextService } from '@services/context';

// eslint-disable-next-line @typescript-eslint/require-await
const contextRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get context for a branch
  fastify.get(
    '/:branchId',
    {
      schema: {
        description: 'Get context for a branch (messages + ancestor facts)',
        tags: ['Context'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        querystring: Type.Object({
          maxMessages: Type.Optional(Type.Number({ default: 50 })),
          includeAncestorFacts: Type.Optional(Type.Boolean({ default: true })),
          maxAncestorDepth: Type.Optional(Type.Number({ default: 5 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              branchId: Type.String(),
              branchTopic: Type.String(),
              messages: Type.Array(
                Type.Object({
                  id: Type.String(),
                  role: Type.String(),
                  content: Type.String(),
                  createdAt: Type.String(),
                })
              ),
              allFacts: Type.Array(
                Type.Object({
                  branchId: Type.String(),
                  branchTopic: Type.String(),
                  isCurrent: Type.Boolean(),
                  facts: Type.Array(
                    Type.Object({
                      id: Type.String(),
                      key: Type.String(),
                      value: Type.String(),
                      confidence: Type.Number(),
                    })
                  ),
                })
              ),
            }),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { branchId } = request.params;
      const { maxMessages, includeAncestorFacts, maxAncestorDepth } = request.query;

      const result = await contextService.get(branchId, {
        policy: { maxMessages, includeAncestorFacts, maxAncestorDepth },
      });

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Failed to get context' },
        });
      }

      return reply.send({
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        data: result.data!,
      });
    }
  );

  // Get all facts for a conversation (for "all messages" view)
  fastify.get(
    '/conversation/:conversationId/facts',
    {
      schema: {
        description: 'Get all facts for all branches in a conversation',
        tags: ['Context'],
        params: Type.Object({
          conversationId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              conversationId: Type.String(),
              allFacts: Type.Array(
                Type.Object({
                  branchId: Type.String(),
                  branchTopic: Type.String(),
                  facts: Type.Array(
                    Type.Object({
                      id: Type.String(),
                      key: Type.String(),
                      value: Type.String(),
                      confidence: Type.Number(),
                    })
                  ),
                })
              ),
            }),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({ message: Type.String() }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { conversationId } = request.params;

      const branches = await fastify.prisma.branch.findMany({
        where: { conversationId },
        include: { facts: true },
        orderBy: { createdAt: 'asc' },
      });

      if (branches.length === 0) {
        return reply.send({
          success: true,
          data: {
            conversationId,
            allFacts: [],
          },
        });
      }

      const allFacts = branches.map((branch) => ({
        branchId: branch.id,
        branchTopic: branch.summary ?? 'Unknown',
        facts: branch.facts.map((f) => ({
          id: f.id,
          key: f.key,
          value: f.value,
          confidence: f.confidence,
        })),
      }));

      return reply.send({
        success: true,
        data: {
          conversationId,
          allFacts,
        },
      });
    }
  );

  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check if Context service is healthy',
        tags: ['Context'],
        response: {
          200: Type.Object({
            status: Type.String(),
            service: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const health = await contextService.healthCheck();
      return reply.send(health);
    }
  );
};

export default contextRoutes;
