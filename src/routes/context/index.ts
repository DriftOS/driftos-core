import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { contextService } from '@services/context';

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
        typescriptresponse: {
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
        data: result.data!,
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
