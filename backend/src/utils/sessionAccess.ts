/**
 * Session ownership helper.
 *
 * Returns:
 *  - 'ok'           : caller owns the session (or is admin)
 *  - 'not_found'    : session doesn't exist (caller should treat as 404)
 *  - 'forbidden'    : session exists but belongs to a different user
 *
 * Historical sessions with `userId = null` are treated as admin-only.
 */
import type { FastifyRequest } from 'fastify';
import { prisma } from '../db/client.js';

export type SessionAccessResult = 'ok' | 'not_found' | 'forbidden';

export async function checkSessionAccess(
  request: FastifyRequest,
  sessionId: string,
): Promise<SessionAccessResult> {
  const callerId = request.user?.id;
  const callerRole = request.user?.role;

  // Without a request.user we cannot enforce ownership; routes should never
  // reach this helper without going through apiKeyAuth. Defensive 403.
  if (!callerId) return 'forbidden';

  // Admin bypasses ownership; admins still need the session to exist.
  if (callerRole === 'admin') {
    const exists = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    return exists ? 'ok' : 'not_found';
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session) return 'not_found';

  // Null-owned sessions are admin-only by design.
  if (session.userId === null) return 'forbidden';

  return session.userId === callerId ? 'ok' : 'forbidden';
}
