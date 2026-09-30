import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, or, ilike, and, desc, asc, sql } from 'drizzle-orm';
import { authenticate, requireRole, generateToken } from '../../infrastructure/auth/auth.js';
import { verifyPassword, hashPassword } from '../../infrastructure/auth/crypto.js';
import { LoginRequestSchema, UserRole } from '@acorn/contracts';
import { z } from 'zod';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../../shared/errors.js';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole),
  avatarUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.nativeEnum(UserRole).optional(),
  avatarUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const ResetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

function sessionCookie(value: string, maxAge: number) {
  const sameSite = process.env.NODE_ENV === 'production' ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `acorn_token=${value}; Path=/; HttpOnly; ${sameSite}; Max-Age=${maxAge}`;
}

const UserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

export const identityPlugin: FastifyPluginAsync = async (fastify) => {
  // Login
  fastify.post('/login', async (request, reply) => {
    const body = LoginRequestSchema.parse(request.body);

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.email.toLowerCase()));

    if (!user) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    }

    if (!Object.values(UserRole).includes(user.role as any)) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Unsupported user role' });
    }

    if (user.isActive === false) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'User account is deactivated' });
    }

    const isMatch = verifyPassword(body.password, user.passwordHash);
    if (!isMatch) {
      return reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      tokenVersion: user.tokenVersion ?? 1,
    });

    // Set HTTP-only session cookie
    reply.header(
      'Set-Cookie',
      sessionCookie(encodeURIComponent(token), 86400)
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      },
    };
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.header(
      'Set-Cookie',
      sessionCookie('', 0)
    );
    return { success: true };
  });

  // Get current user profile
  fastify.get('/me', { preHandler: [authenticate] }, async (request) => {
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(eq(schema.users.id, request.user!.id));
    return user ?? request.user;
  });

  // List users (Protected: only ADMIN, TEACHER)
  fastify.get('/users', { preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.TEACHER])] }, async (request) => {
    const parsedQuery = UserQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    const conditions: any[] = [];
    if (parsedQuery.role) {
      conditions.push(eq(schema.users.role, parsedQuery.role));
    }
    if (parsedQuery.status) {
      conditions.push(eq(schema.users.isActive, parsedQuery.status === 'active'));
    }
    if (parsedQuery.search && parsedQuery.search.trim()) {
      const term = `%${parsedQuery.search.trim()}%`;
      conditions.push(or(ilike(schema.users.name, term), ilike(schema.users.email, term)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const isPaginatedRequest =
      rawQuery.page !== undefined ||
      rawQuery.limit !== undefined ||
      rawQuery.search !== undefined ||
      rawQuery.role !== undefined ||
      rawQuery.status !== undefined ||
      rawQuery.paginate === 'true';

    if (isPaginatedRequest && !parsedQuery.all) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(whereClause);
      const total = countResult?.count ?? 0;

      const items = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
          role: schema.users.role,
          avatarUrl: schema.users.avatarUrl,
          isActive: schema.users.isActive,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(whereClause)
        .orderBy(desc(schema.users.createdAt), asc(schema.users.id))
        .limit(parsedQuery.limit)
        .offset((parsedQuery.page - 1) * parsedQuery.limit);

      return {
        items,
        total,
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        totalPages: Math.ceil(total / parsedQuery.limit) || 1,
      };
    }

    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(whereClause)
      .orderBy(desc(schema.users.createdAt), asc(schema.users.id));

    if (rawQuery.paginate === 'true' || isPaginatedRequest) {
      return {
        items: rows,
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
      };
    }

    return rows;
  });

  // Admin: Create user
  fastify.post('/users', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateUserSchema.parse(request.body);

    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, body.email.toLowerCase()));

    if (existing) {
      throw new BadRequestError('User with this email already exists');
    }

    const passwordHash = hashPassword(body.password);
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        role: body.role,
        avatarUrl: body.avatarUrl,
        isActive: body.isActive ?? true,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        isActive: schema.users.isActive,
      });

    return reply.status(201).send(newUser);
  });

  // Admin: Update user
  fastify.put('/users/:id', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateUserSchema.parse(request.body);

    const [existing] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (!existing) throw new NotFoundError('User not found');

    const updatePayload: any = { ...body };
    if (body.isActive === false && existing.isActive !== false) {
      updatePayload.tokenVersion = (existing.tokenVersion || 1) + 1;
    }

    const [updated] = await db
      .update(schema.users)
      .set(updatePayload)
      .where(eq(schema.users.id, id))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        avatarUrl: schema.users.avatarUrl,
        isActive: schema.users.isActive,
      });

    if (!updated) throw new NotFoundError('User not found');
    return updated;
  });

  // Admin: Reset user password
  fastify.post('/users/:id/reset-password', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ResetPasswordSchema.parse(request.body);

    const [existing] = await db
      .select({ id: schema.users.id, tokenVersion: schema.users.tokenVersion })
      .from(schema.users)
      .where(eq(schema.users.id, id));

    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const passwordHash = hashPassword(body.newPassword);
    const nextTokenVersion = (existing.tokenVersion || 1) + 1;
    await db
      .update(schema.users)
      .set({ passwordHash, tokenVersion: nextTokenVersion })
      .where(eq(schema.users.id, id));

    return { success: true };
  });
};
