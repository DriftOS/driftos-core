import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { factsService } from '@services/facts';

const factsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Extract facts from a branch
  fastify.post(
    '/:branchId/extract',
    {
      schema: {
        description: 'Extract facts from a branch',
        tags: ['Facts'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              branchId: Type.String(),
              facts: Type.Array(
                Type.Object({
                  id: Type.String(),
                  key: Type.String(),
                  value: Type.String(),
                  confidence: Type.Number(),
                  messageId: Type.Union([Type.String(), Type.Null()]),
                  createdAt: Type.String(),
                  branchId: Type.String(),
                })
              ),
              extractedCount: Type.Number(),
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

      const result = await factsService.extract(branchId);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: { message: result.error?.message || 'Extraction failed' },
        });
      }

      return reply.send({
        success: true,
        data: {
          ...result.data!,
          facts: result.data!.facts.map((f) => ({
            ...f,
            createdAt: f.createdAt.toISOString(),
          })),
        },
      });
    }
  );

  // Get facts for a branch (without re-extracting)
  fastify.get(
    '/:branchId',
    {
      schema: {
        description: 'Get existing facts for a branch',
        tags: ['Facts'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                key: Type.String(),
                value: Type.String(),
                confidence: Type.Number(),
                messageId: Type.Union([Type.String(), Type.Null()]),
                createdAt: Type.String(),
                branchId: Type.String(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { branchId } = request.params;

      const facts = await fastify.prisma.fact.findMany({
        where: { branchId },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: facts.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
        })),
      });
    }
  );

  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check if Facts service is healthy',
        tags: ['Facts'],
        response: {
          200: Type.Object({
            status: Type.String(),
            service: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const health = await factsService.healthCheck();
      return reply.send(health);
    }
  );
};

export default factsRoutes;
