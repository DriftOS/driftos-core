import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

/**
 * Example Routes - Demonstrates Direct Database Access
 *
 * This route uses DIRECT Prisma access for simple CRUD operations.
 * This is appropriate for:
 * - Simple database queries
 * - No complex business logic
 * - Speed is critical
 *
 * Compare this to /todos route which uses the Golden Orchestrator pattern.
 * For complex workflows, see: src/routes/todos/ and src/services/todo/
 */
const exampleRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get all examples
  fastify.get(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Get all examples',
        tags: ['Example'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                title: Type.String(),
                description: Type.String(),
                createdAt: Type.String({ format: 'date-time' }),
                updatedAt: Type.String({ format: 'date-time' }),
              })
            ),
          }),
        },
      },
    },
    async (_request, reply) => {
      const examples = await fastify.prisma.example.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: examples.map((ex) => ({
          ...ex,
          createdAt: ex.createdAt.toISOString(),
          updatedAt: ex.updatedAt.toISOString(),
        })),
      });
    }
  );

  // Create example
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Create a new example',
        tags: ['Example'],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          title: Type.String({ minLength: 1 }),
          description: Type.String(),
        }),
        response: {
          201: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              id: Type.String(),
              title: Type.String(),
              description: Type.String(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { title, description } = request.body;

      const example = await fastify.prisma.example.create({
        data: {
          title,
          description,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          ...example,
          createdAt: example.createdAt.toISOString(),
          updatedAt: example.updatedAt.toISOString(),
        },
      });
    }
  );
};

export default exampleRoutes;
