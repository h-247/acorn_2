import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import { LoginRequestSchema, UserRole } from '@acorn/contracts';

export const identityPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);
    const store = db.getStore();
    const user = store.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());

    if (!user) {
      return reply.status(401).send({ message: 'Invalid email or password' });
    }

    return {
      token: user.id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  });

  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    return request.user;
  });

  fastify.get('/users', { preHandler: [authenticate] }, async (request) => {
    const store = db.getStore();
    return store.users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      avatarUrl: u.avatarUrl,
    }));
  });
};
