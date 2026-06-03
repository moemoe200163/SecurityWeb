import type { Page } from '@playwright/test';

/**
 * Set a known API key in localStorage. The dev server has no real auth
 * gateway, so any non-empty string matching the 67-char "sk-" + 64 hex
 * format will be accepted by the backend apiKeyAuth middleware when the
 * matching row exists in the DB (seed creates the test-admin row).
 *
 * The default key matches backend/tests/setup.ts TEST_API_KEY default
 * so this works without env config in local + CI.
 */
export const DEFAULT_TEST_API_KEY =
  'sk-' + '0000000000000000000000000000000000000000000000000000000000000001';

export async function setAdminApiKey(page: Page, apiKey: string = DEFAULT_TEST_API_KEY): Promise<void> {
  await page.addInitScript(
    ([key]) => {
      window.localStorage.setItem('api_key', key);
    },
    [apiKey]
  );
}

/**
 * Clear any API key from localStorage (used to test 401/ApiKeyRequired).
 */
export async function clearAdminApiKey(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('api_key');
  });
}
