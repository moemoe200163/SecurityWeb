import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Force test files to load DATABASE_URL/.env from backend root if needed.
    env: {
      // Re-export here so child imports see the same env as the dev server.
      NODE_ENV: 'test',
    },
  },
});
