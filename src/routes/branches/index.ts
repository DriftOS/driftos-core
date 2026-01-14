import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { contextService } from '../../services/context';
import { factsService } from '../../services/facts';

/**
 * Branch Routes
 *
 * GET  /branches/:branchId         - Get branch details
 * GET  /branches/:branchId/context - Get messages with ancestor facts
 * GET  /branches/:branchId/facts   - List all facts for branch
 * POST /branches/:branchId/facts   - Extract facts from branch
 */
const branchRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get branch details
  fastify.get(
    '/:branchId',
    {
      schema: {
        description: 'Get branch details including message and fact counts',
        tags: ['Branches'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              id: Type.String(),
              conversationId: Type.String(),
              topic: Type.String(),
              parentId: Type.Optional(Type.String()),
              driftType: Type.Optional(Type.String()),
              depth: Type.Number(),
              messageCount: Type.Number(),
              factCount: Type.Number(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
            }),
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
      const { branchId } = request.params;

      const branch = await fastify.prisma.branch.findUnique({
        where: { id: branchId },
        include: {
          conversation: { select: { id: true, userId: true } },
          _count: { select: { messages: true, facts: true } },
        },
      });

      if (!branch) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Branch not found' },
        });
      }

      // Check ownership
      if (branch.conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this branch' },
        });
      }

      return reply.send({
        success: true,
        data: {
          id: branch.id,
          conversationId: branch.conversationId,
          topic: branch.summary ?? 'Unknown',
          parentId: branch.parentId ?? undefined,
          driftType: branch.driftType ?? undefined,
          depth: branch.branchDepth,
          messageCount: branch._count.messages,
          factCount: branch._count.facts,
          createdAt: branch.createdAt.toISOString(),
          updatedAt: branch.updatedAt.toISOString(),
        },
      });
    }
  );

  // Get branch context (messages + ancestor facts)
  fastify.get(
    '/:branchId/context',
    {
      schema: {
        description: 'Get branch messages with ancestor facts for context',
        tags: ['Branches'],
        params: Type.Object({
          branchId: Type.String(),
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
              ancestorFacts: Type.Array(
                Type.Object({
                  branchId: Type.String(),
                  branchTopic: Type.String(),
                  isCurrent: Type.Boolean(),
                  facts: Type.Array(Type.Any()),
                })
              ),
            }),
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
      const { branchId } = request.params;

      // Verify branch exists and check ownership
      const branch = await fastify.prisma.branch.findUnique({
        where: { id: branchId },
        include: { conversation: { select: { userId: true } } },
      });

      if (!branch) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Branch not found' },
        });
      }

      if (branch.conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this branch' },
        });
      }

      // Use context service to get messages + ancestor facts
      const result = await contextService.get(branchId);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: { message: result.error?.message || 'Failed to load context' },
        });
      }

      const context = result.data!;

      return reply.send({
        success: true,
        data: {
          branchId,
          branchTopic: branch.summary ?? 'Unknown',
          messages: context.messages,
          ancestorFacts: context.allFacts,
        },
      });
    }
  );

  // Get all facts for branch
  fastify.get(
    '/:branchId/facts',
    {
      schema: {
        description: 'Get all facts for a branch with message provenance',
        tags: ['Branches'],
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
                  fact: Type.Any(),
                  messageIds: Type.Array(Type.String()),
                  createdAt: Type.String(),
                })
              ),
            }),
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
      const { branchId } = request.params;

      // Verify branch exists and check ownership
      const branch = await fastify.prisma.branch.findUnique({
        where: { id: branchId },
        include: { conversation: { select: { userId: true } } },
      });

      if (!branch) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Branch not found' },
        });
      }

      if (branch.conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this branch' },
        });
      }

      const facts = await fastify.prisma.fact.findMany({
        where: { branchId },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({
        success: true,
        data: {
          branchId,
          facts: facts.map((f) => ({
            id: f.id,
            fact: f.fact,
            messageIds: f.messageIds,
            createdAt: f.createdAt.toISOString(),
          })),
        },
      });
    }
  );

  // Extract facts from branch
  fastify.post(
    '/:branchId/facts',
    {
      schema: {
        description: 'Extract facts from branch messages using LLM',
        tags: ['Branches'],
        params: Type.Object({
          branchId: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              branchId: Type.String(),
              extractedCount: Type.Number(),
              facts: Type.Array(Type.Any()),
            }),
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
      const { branchId } = request.params;

      // Verify branch exists and check ownership
      const branch = await fastify.prisma.branch.findUnique({
        where: { id: branchId },
        include: { conversation: { select: { userId: true } } },
      });

      if (!branch) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Branch not found' },
        });
      }

      if (branch.conversation.userId !== (request.userId ?? null)) {
        return reply.status(403).send({
          success: false,
          error: { message: 'Access denied to this branch' },
        });
      }

      // Use facts service to extract facts
      const result = await factsService.extract(branchId);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: { message: result.error?.message || 'Failed to extract facts' },
        });
      }

      return reply.send({
        success: true,
        data: {
          branchId,
          extractedCount: result.data!.facts.length,
          facts: result.data!.facts,
        },
      });
    }
  );
};

export default branchRoutes;
