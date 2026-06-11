/**
 * Vitest global setup.
 *
 * Ensures a deterministic test admin user exists so API tests can authenticate
 * with a known API key. Run the seed (`npm run db:seed`) once before tests so
 * the production-style data (tool templates, demo alerts) is also present.
 *
 * Required env:
 *   - TEST_API_KEY  Full "sk-" prefixed API key (67 chars total).
 *                   If unset, defaults to a fixed value (see below) so local
 *                   runs work without extra configuration.
 *   - DATABASE_URL  Same Postgres instance the API server uses.
 */
import { PrismaClient } from '@prisma/client';
import { hashApiKey, extractPrefix, isValidKeyFormat } from '../src/utils/keyHash.js';

/**
 * The full API key sent in X-API-Key headers.
 * Defaults to a deterministic test key for local development.
 */
export const TEST_API_KEY =
  process.env.TEST_API_KEY ||
  // Deterministic test key: "sk-" + 64 hex chars. Do NOT use in any non-test env.
  'sk-' + '0000000000000000000000000000000000000000000000000000000000000001';

export const TEST_USER_ID = 'test-admin';

export default async function setup(): Promise<void> {
  if (!isValidKeyFormat(TEST_API_KEY)) {
    throw new Error(
      `TEST_API_KEY must be "sk-" + 64 hex chars (67 total, got ${TEST_API_KEY.length}). ` +
        'Generate one with: node -e "console.log(\'sk-\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  const prefix = extractPrefix(TEST_API_KEY);
  const hashed = hashApiKey(TEST_API_KEY);

  const prisma = new PrismaClient();
  try {
    // Make setup idempotent: first drop any stale rows that point at
    // TEST_USER_ID but use a *different* keyPrefix, then upsert.
    // Without this, repeated runs (or runs after a `db:seed`) trip the
    // unique constraint on `users.id` and the suite can't start.
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.user.upsert({
      where: { keyPrefix: prefix },
      update: { id: TEST_USER_ID, role: 'admin' },
      create: {
        id: TEST_USER_ID,
        keyPrefix: prefix,
        hashedKey: hashed,
        role: 'admin',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
