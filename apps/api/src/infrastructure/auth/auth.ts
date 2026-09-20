import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@acorn/contracts';
import { createHmac } from 'node:crypto';
import { db } from '../persistence/db.js';
import * as schema from '../persistence/schema.js';
import { eq, and } from 'drizzle-orm';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { config } from '../../shared/config.js';

export interface AuthContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tokenVersion?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

// Generate signed JWT token
export function generateToken(payload: AuthContext, expiresInSeconds: number = 86400): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// Verify signed JWT token
export function verifyToken(token: string): AuthContext | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = createHmac('sha256', config.jwtSecret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (!decoded.id || !decoded.email || !decoded.role) return null;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role as UserRole,
      tokenVersion: decoded.tokenVersion,
    };
  } catch {
    return null;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  let token: string | undefined;

  let isCookieAuth = false;

  // 1. Check Bearer Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Check cookie if authorization header not present
  if (!token && request.headers.cookie) {
    const cookies = request.headers.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === 'acorn_token' && val) {
        token = decodeURIComponent(val);
        isCookieAuth = true;
        break;
      }
    }
  }

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  // Reject cross-origin unsafe mutations using cookie authentication
  if (isCookieAuth && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
    const rawOrigin = request.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (origin && origin !== config.webOrigin) {
      throw new ForbiddenError('Cross-origin mutation forbidden');
    }
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }

  if (!Object.values(UserRole).includes(payload.role as any)) {
    throw new UnauthorizedError('Unsupported user role');
  }

  // Verify user still exists in database
  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isActive: schema.users.isActive,
      tokenVersion: schema.users.tokenVersion,
    })
    .from(schema.users)
    .where(eq(schema.users.id, payload.id));

  if (!user) {
    throw new UnauthorizedError('User account not found');
  }

  if (user.isActive === false) {
    throw new UnauthorizedError('User account is deactivated');
  }

  const userVersion = user.tokenVersion ?? 1;
  const payloadVersion = payload.tokenVersion ?? 1;
  if (payloadVersion !== userVersion) {
    throw new UnauthorizedError('Session has been invalidated. Please log in again.');
  }

  if (!Object.values(UserRole).includes(user.role as any)) {
    throw new UnauthorizedError('Unsupported user role');
  }

  request.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    tokenVersion: user.tokenVersion,
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenError(`Action requires one of: ${allowedRoles.join(', ')}`);
    }
  };
}

// Resource-level authorization: Class access
export async function assertClassAccess(user: AuthContext, classId: string) {
  if (user.role === UserRole.ADMIN) {
    return;
  }

  if (user.role === UserRole.TEACHER) {
    const [cls] = await db
      .select({ id: schema.classes.id, teacherId: schema.classes.teacherId })
      .from(schema.classes)
      .where(eq(schema.classes.id, classId));

    if (!cls) throw new NotFoundError('Class not found');
    if (cls.teacherId !== user.id) {
      throw new ForbiddenError('You do not have permission to access this class');
    }
    return;
  }

  if (user.role === UserRole.STUDENT) {
    const [enrollment] = await db
      .select({ id: schema.classEnrollments.id })
      .from(schema.classEnrollments)
      .where(
        and(
          eq(schema.classEnrollments.classId, classId),
          eq(schema.classEnrollments.learnerId, user.id)
        )
      );

    if (!enrollment) {
      throw new ForbiddenError('You are not enrolled in this class');
    }
    return;
  }

  throw new ForbiddenError('Access denied');
}

// Resource-level authorization: Learner profile/data access
export async function assertLearnerAccess(user: AuthContext, learnerId: string) {
  if (user.role === UserRole.ADMIN) {
    return;
  }

  if (user.role === UserRole.STUDENT) {
    if (user.id !== learnerId) {
      throw new ForbiddenError('You cannot view data of other students');
    }
    return;
  }

  if (user.role === UserRole.TEACHER) {
    // Check if learner is enrolled in any of this teacher's classes
    const teacherClasses = await db
      .select({ id: schema.classes.id })
      .from(schema.classes)
      .where(eq(schema.classes.teacherId, user.id));

    const classIds = teacherClasses.map((c) => c.id);
    if (classIds.length === 0) {
      throw new ForbiddenError('You do not have active classes with this learner');
    }

    const enrollments = await db
      .select({ id: schema.classEnrollments.id, classId: schema.classEnrollments.classId })
      .from(schema.classEnrollments)
      .where(eq(schema.classEnrollments.learnerId, learnerId));

    const isEnrolled = enrollments.some((e) => classIds.includes(e.classId));
    if (!isEnrolled) {
      throw new ForbiddenError('You can only access students enrolled in your classes');
    }
    return;
  }

  throw new ForbiddenError('Access denied');
}
