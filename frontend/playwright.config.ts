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
      command: 'cd ../backend && npx tsx src/index.ts',
      port: 4000,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'pnpm dev',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
