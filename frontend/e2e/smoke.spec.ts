import { test, expect } from '@playwright/test';

test.describe('Smoke: Core pages load', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SecurityWeb|安全/);
  });

  test('alerts page loads', async ({ page }) => {
    await page.goto('/alerts');
    // Should show either content or API key prompt
    await expect(page.locator('body')).toBeVisible();
  });

  test('tools page loads', async ({ page }) => {
    await page.goto('/tools');
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('threat investigation page loads', async ({ page }) => {
    await page.goto('/threat/investigate');
    await expect(page.locator('body')).toBeVisible();
  });

  test('pentest assist page loads', async ({ page }) => {
    await page.goto('/pentest/assist');
    await expect(page.locator('body')).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Smoke: API connectivity', () => {
  test('backend health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:4000/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('frontend proxies API calls', async ({ request }) => {
    // The frontend rewrites /api/* to the backend
    const response = await request.get('/api/tools/templates', {
      headers: { 'X-API-Key': 'invalid-key' },
    });
    // Should get 401 (not 502 or connection error), proving proxy works
    expect(response.status()).toBe(401);
  });
});
