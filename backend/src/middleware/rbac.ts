import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '../types/rbac.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
      });
    }

    const userRole = request.user.role;

    if (!allowedRoles.includes(userRole)) {
      return reply.status(403).send({
        error: 'Permission denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

export const requireAdmin = requireRole('admin');
export const requireUser = requireRole('user', 'admin');
