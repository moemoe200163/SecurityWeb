import { prisma } from '../db/client.js';
import { generateApiKey } from '../utils/keyHash.js';
import { sanitizeAuditDetails } from '../utils/sanitize.js';

export interface ApiKeyMetadata {
  prefix: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
}

export interface RotateResult {
  plaintext: string;
  metadata: ApiKeyMetadata;
}

export interface ApiKeyWithUser extends ApiKeyMetadata {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

function metadataFromUser(user: {
  keyPrefix: string | null;
  keyCreatedAt: Date | null;
  keyRevokedAt: Date | null;
  keyExpiresAt: Date | null;
}): ApiKeyMetadata {
  return {
    prefix: user.keyPrefix,
    createdAt: user.keyCreatedAt?.toISOString() ?? null,
    revokedAt: user.keyRevokedAt?.toISOString() ?? null,
    expiresAt: user.keyExpiresAt?.toISOString() ?? null,
  };
}

export async function getMyApiKey(userId: string): Promise<ApiKeyMetadata> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      keyPrefix: true,
      keyCreatedAt: true,
      keyRevokedAt: true,
      keyExpiresAt: true,
    },
  });
  if (!user) {
    return { prefix: null, createdAt: null, revokedAt: null, expiresAt: null };
  }
  return metadataFromUser(user);
}

export async function rotateMyApiKey(userId: string): Promise<RotateResult> {
  return rotate(userId, userId);
}

export async function rotateUserApiKey(
  targetUserId: string,
  adminId: string
): Promise<RotateResult> {
  return rotate(targetUserId, adminId);
}

async function rotate(targetUserId: string, actorId: string): Promise<RotateResult> {
  const { plaintext, prefix, hashed } = generateApiKey();
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: {
        keyPrefix: prefix,
        hashedKey: hashed,
        keyCreatedAt: now,
        keyRevokedAt: null,
        keyExpiresAt: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'rotate_key',
        resourceType: 'api_key',
        resourceId: targetUserId,
        details: sanitizeAuditDetails({ target: targetUserId }),
      },
    }),
  ]);

  return {
    plaintext,
    metadata: {
      prefix,
      createdAt: now.toISOString(),
      revokedAt: null,
      expiresAt: null,
    },
  };
}

export async function listAllApiKeys(): Promise<ApiKeyWithUser[]> {
  // No email column on User in this schema; use id as a stand-in until a User.email field is added.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      keyPrefix: true,
      keyCreatedAt: true,
      keyRevokedAt: true,
      keyExpiresAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return users.map((u) => ({
    ...metadataFromUser(u),
    user: { id: u.id, email: u.id, role: u.role },
  }));
}

export async function revokeUserApiKey(
  targetUserId: string,
  adminId: string,
  reason?: string
): Promise<void> {
  // Idempotent: if already revoked, no-op (no audit log)
  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { keyRevokedAt: true },
  });
  if (existing?.keyRevokedAt) {
    return;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { keyPrefix: null, hashedKey: null, keyRevokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'revoke_key',
        resourceType: 'api_key',
        resourceId: targetUserId,
        details: sanitizeAuditDetails({
          target: targetUserId,
          reason: reason ?? 'admin_action',
        }),
      },
    }),
  ]);
}
