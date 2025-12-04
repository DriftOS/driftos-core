import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import bcrypt from 'bcryptjs';
import { ValidationError, UnauthorizedError } from '../../utils/errors.js';

const authRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  // Login endpoint
  fastify.post(
    '/login',
    {
      schema: {
        description: 'User login',
        tags: ['Auth'],
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          password: Type.String({ minLength: 6 }),
        }),
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              token: Type.String(),
              user: Type.Object({
                id: Type.String(),
                email: Type.String(),
                role: Type.String(),
              }),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // Find user by email (example - replace with actual DB query)
      const user = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify password (assuming password is hashed in DB)
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Generate JWT token
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role || 'user',
      });

      return reply.send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role || 'user',
          },
        },
      });
    }
  );

  // Register endpoint
  fastify.post(
    '/register',
    {
      schema: {
        description: 'User registration',
        tags: ['Auth'],
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          password: Type.String({ minLength: 6 }),
          name: Type.String({ minLength: 1 }),
        }),
        response: {
          201: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              token: Type.String(),
              user: Type.Object({
                id: Type.String(),
                email: Type.String(),
                name: Type.String(),
                role: Type.String(),
              }),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      // Check if user exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ValidationError('Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await fastify.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'user',
        },
      });

      // Generate JWT token
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.status(201).send({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    }
  );

  // Verify token endpoint
  fastify.get(
    '/verify',
    {
      preValidation: [fastify.authenticate],
      schema: {
        description: 'Verify JWT token',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            success: Type.Literal(true),
            data: Type.Object({
              user: Type.Object({
                id: Type.String(),
                email: Type.String(),
                role: Type.String(),
              }),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          user: request.user,
        },
      });
    }
  );
};

export default authRoutes;
