import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { TodoService } from '@services/todo/index.js';

/**
 * Todo Routes - Demonstrates Golden Orchestrator Pattern
 *
 * This route uses the TodoService which implements the pipeline pattern:
 * Route → Service → Orchestrator → Operations (validate → create → notify)
 *
 * Compare this to the /examples route which uses direct Prisma access.
 * The golden pattern provides:
 * - Automatic performance tracking
 * - Testable operations
 * - Clean separation of concerns
 * - Error handling and timeout protection
 */
const todoRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Create service instance with Prisma
  const todoService = new TodoService(fastify.prisma);

  // Create Todo endpoint - Uses Golden Orchestrator Pattern
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Create a new todo using the Golden Orchestrator pattern',
        tags: ['Todos'],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          title: Type.String({
            minLength: 1,
            maxLength: 200,
            description: 'Todo title',
          }),
          description: Type.String({
            maxLength: 1000,
            description: 'Todo description',
          }),
        }),
        response: {
          201: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              id: Type.String(),
              title: Type.String(),
              description: Type.String(),
              completed: Type.Boolean(),
              userId: Type.String(),
              createdAt: Type.String({ format: 'date-time' }),
              updatedAt: Type.String({ format: 'date-time' }),
            }),
            metadata: Type.Optional(
              Type.Object({
                duration: Type.Number({ description: 'Total execution time in ms' }),
                metrics: Type.Optional(Type.Record(Type.String(), Type.Number())),
              })
            ),
          }),
          400: Type.Object({
            success: Type.Literal(false),
            error: Type.Object({
              message: Type.String(),
              statusCode: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // Call the TodoService - it will use the orchestrator pattern internally
      const result = await todoService.createTodo({
        title: request.body.title,
        description: request.body.description,
        userId: request.user.id,
      });

      // Handle orchestrator errors
      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error?.message || 'Failed to create todo',
            statusCode: 400,
          },
        });
      }

      // Success response with optional performance metadata
      return reply.status(201).send({
        success: true,
        data: {
          ...result.data!,
          description: result.data!.description || '',
          createdAt: result.data!.createdAt.toISOString(),
          updatedAt: result.data!.updatedAt.toISOString(),
        },
        metadata: {
          duration: result.duration,
          metrics: result.metrics, // Per-operation timing
        },
      });
    }
  );

  // Health check for the todo service
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check if the Todo service is healthy',
        tags: ['Todos'],
        response: {
          200: Type.Object({
            status: Type.String(),
            service: Type.String(),
          }),
        },
      },
    },
    async (_request, reply) => {
      const health = await todoService.healthCheck();
      return reply.send(health);
    }
  );

  // Get all todos (example endpoint - you can expand this)
  fastify.get(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Get all todos for the current user',
        tags: ['Todos'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Array(
              Type.Object({
                id: Type.String(),
                title: Type.String(),
                description: Type.String(),
                completed: Type.Boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      // Simple query - for complex operations, you'd use an orchestrator
      const todos = await fastify.prisma.todo.findMany({
        where: {
          userId: request.user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          description: true,
          completed: true,
        },
      });

      return reply.send({
        success: true,
        data: todos.map((todo) => ({
          ...todo,
          description: todo.description || '',
        })),
      });
    }
  );
};

export default todoRoutes;
