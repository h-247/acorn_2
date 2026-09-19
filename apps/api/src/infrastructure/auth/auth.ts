import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@acorn/contracts';
import { db } from '../persistence/db.js';
import { UnauthorizedError, ForbiddenError } from '../../shared/errors.js';

export interface AuthContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthContext;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default demo fallback: if no token is provided in local dev, identify as Ms. Taylor (Teacher)
    // or parse simple role token: Bearer student-emma or Bearer teacher-taylor
    const store = db.getStore();
    request.user = {
      id: store.users[0].id,
      email: store.users[0].email,
      name: store.users[0].name,
      role: store.users[0].role as UserRole,
    };
    return;
  }

  const token = authHeader.substring(7);
  const store = db.getStore();

  if (token === 'student-emma') {
    const u = store.users.find((user) => user.email.includes('emma'));
    if (u) {
      request.user = { id: u.id, email: u.email, name: u.name, role: u.role as UserRole };
      return;
    }
  }

  const user = store.users.find((u) => u.id === token || u.email === token);
  if (!user) {
    throw new UnauthorizedError('Invalid authorization token');
  }

  request.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
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
