import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const userRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Get current user
  fastify.get(
    '/me',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Get current user profile',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              id: Type.String(),
              email: Type.String(),
              name: Type.String(),
              role: Type.String(),
              createdAt: Type.String(),
              updatedAt: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return reply.notFound('User not found');
      }

      return reply.send({
        success: true,
        data: {
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    }
  );
};

export default userRoutes;
