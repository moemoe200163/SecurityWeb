/**
 * Vitest global setup.
 *
 * Ensures a deterministic test admin user exists so API tests can authenticate
 * with a known API key. Run the seed (`npm run db:seed`) once before tests so
 * the production-style data (tool templates, demo alerts) is also present.
 *
 * Required env:
 *   - TEST_API_KEY  64-char hex string used as the test admin's API key.
 *                   If unset, defaults to a fixed value (see below) so local
 *                   runs work without extra configuration.
 *   - DATABASE_URL  Same Postgres instance the API server uses.
 */
import { PrismaClient } from '@prisma/client';

export const TEST_API_KEY =
  process.env.TEST_API_KEY ||
  // 64-char hex placeholder for local tests. Do NOT use in any non-test env.
  '0000000000000000000000000000000000000000000000000000000000000001';

export const TEST_USER_ID = 'test-admin';

export default async function setup(): Promise<void> {
  if (TEST_API_KEY.length !== 64) {
    throw new Error(
      `TEST_API_KEY must be 64 chars (got ${TEST_API_KEY.length}). ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({
      where: { apiKey: TEST_API_KEY },
      update: { id: TEST_USER_ID, role: 'admin' },
      create: {
        id: TEST_USER_ID,
        apiKey: TEST_API_KEY,
        role: 'admin',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
