import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      // Run a tiny inline script that imports the same setup logic and
      // awaits the default export. Then start the backend.
      // Without this, admin-keys / admin-retention / api-key-lifecycle
      // specs all 401 because the test-admin row never exists.
      command: 'cd ../backend && npx tsx -e "import(\'./tests/setup.js\').then(m => m.default()).then(() => process.exit(0))" && npx tsx src/index.ts',
      port: 4000,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        TEST_API_KEY: 'sk-0000000000000000000000000000000000000000000000000000000000000001',
        DATABASE_URL: 'postgresql://securityweb:securityweb123@localhost:5432/securityweb',
      },
    },
    {
      command: 'pnpm dev --webpack',
      port: 3000,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        TEST_API_KEY: 'sk-0000000000000000000000000000000000000000000000000000000000000001',
      },
    },
  ],
});
