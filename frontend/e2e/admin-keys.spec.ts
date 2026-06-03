import { test, expect } from '@playwright/test';
import { setAdminApiKey } from './helpers/admin-auth';

test.describe('Admin · API Keys page', () => {
  test('PageHero shows key statistics in commandValue', async ({ page }) => {
    await setAdminApiKey(page);
    await page.goto('/admin/keys');

    // The PageHero commandValue renders a string like "N active · N revoked · N no-key"
    // We assert the pattern, not exact numbers, because the dev DB may have varying seed data.
    const commandValue = page.locator('text=/\\d+ active · \\d+ revoked · \\d+ no-key/');
    await expect(commandValue).toBeVisible({ timeout: 10_000 });
  });

  test('PageHero shows loading... before stats load', async ({ page }) => {
    await setAdminApiKey(page);

    // Block the API response to keep the loading state observable
    await page.route('**/api/admin/keys', async (route) => {
      await new Promise((r) => setTimeout(r, 5_000));
      await route.continue();
    });

    await page.goto('/admin/keys');
    const loading = page.locator('text=/loading\\.\\.\\./');
    await expect(loading).toBeVisible();
  });

  test('rotate modal cannot close without "I have delivered" confirmation', async ({ page }) => {
    await setAdminApiKey(page);
    await page.goto('/admin/keys');

    // Wait for the keys table to render
    await page.waitForSelector('table', { timeout: 10_000 });

    // Click the first Rotate button
    const firstRotate = page.locator('button:has-text("Rotate")').first();
    await firstRotate.click();

    // Modal appears
    const modal = page.getByRole('dialog', { name: 'New key generated' });
    await expect(modal).toBeVisible();

    // Done button is disabled
    const done = modal.locator('button:has-text("Done")');
    await expect(done).toBeDisabled();

    // Try clicking the backdrop (the outer dialog div)
    // Click in the corner where only the backdrop is reachable
    await page.mouse.click(10, 10);
    // Modal should still be open
    await expect(modal).toBeVisible();

    // Try Escape
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();

    // Tick the checkbox
    await modal.locator('input[type="checkbox"]').check();

    // Done button is now enabled
    await expect(done).toBeEnabled();

    // Click Done
    await done.click();
    await expect(modal).not.toBeVisible();
  });
});
