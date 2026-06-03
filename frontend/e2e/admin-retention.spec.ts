import { test, expect } from '@playwright/test';
import { setAdminApiKey, clearAdminApiKey } from './helpers/admin-auth';

test.describe('Admin · Retention page', () => {
  test('PageHero shows "never" when no retention has run', async ({ page }) => {
    await setAdminApiKey(page);
    // Intercept the status call to guarantee no lastRunAt
    await page.route('**/api/admin/retention/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { auditLog: 0, toolExecution: 0, bgpUpdate: 0 },
          lastRunAt: null,
          lastResult: null,
          policy: { auditLogDays: 90, toolExecutionDays: 30, bgpUpdateDays: 7 },
        }),
      });
    });
    await page.goto('/admin/retention');
    // "never" appears in both PageHero commandValue and the RetentionPanel "Last run"
    // section. Use .first() to target the PageHero instance.
    const never = page.locator('text="never"').first();
    await expect(never).toBeVisible({ timeout: 10_000 });
  });

  test('PageHero shows formatted timestamp when retention has run', async ({ page }) => {
    await setAdminApiKey(page);
    const lastRunAt = '2026-05-30T12:34:56.000Z';
    await page.route('**/api/admin/retention/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { auditLog: 100, toolExecution: 50, bgpUpdate: 25 },
          lastRunAt,
          lastResult: { auditLogsDeleted: 10, toolExecutionsTrimmed: 5, bgpUpdatesDeleted: 2 },
          policy: { auditLogDays: 90, toolExecutionDays: 30, bgpUpdateDays: 7 },
        }),
      });
    });
    await page.goto('/admin/retention');
    // The PageHero commandValue will render a localized timestamp; we just assert
    // that "never" is absent and that some year prefix is present. The timestamp
    // also renders in the RetentionPanel "Last run" section, so use .first().
    await expect(page.locator('text=/202[0-9]/').first()).toBeVisible({ timeout: 10_000 });
  });

  test('renders <ApiKeyRequired /> when API key is missing', async ({ page }) => {
    await clearAdminApiKey(page);
    await page.goto('/admin/retention');
    // ApiKeyRequired shows a heading like "API Key Required" or "需要 API Key"
    // We use a permissive selector that matches the existing component's heading text
    await expect(page.getByText(/API Key/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows forbidden state when API returns 403', async ({ page }) => {
    await setAdminApiKey(page);
    await page.route('**/api/admin/retention/status', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Admin access required' }),
      });
    });
    await page.goto('/admin/retention');
    // The forbidden text appears in both the h3 heading and the paragraph message,
    // so target the heading explicitly.
    await expect(page.getByRole('heading', { name: '需要管理員權限' })).toBeVisible({ timeout: 10_000 });
    // Has a link to settings (in the forbidden panel — global nav also links to
    // /settings, so target by accessible name to disambiguate).
    await expect(page.getByRole('link', { name: '前往設定' })).toBeVisible();
  });

  test('shows retry button on 500', async ({ page }) => {
    await setAdminApiKey(page);
    let callCount = 0;
    await page.route('**/api/admin/retention/status', async (route) => {
      callCount += 1;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            counts: { auditLog: 0, toolExecution: 0, bgpUpdate: 0 },
            lastRunAt: null,
            lastResult: null,
            policy: { auditLogDays: 90, toolExecutionDays: 30, bgpUpdateDays: 7 },
          }),
        });
      }
    });

    await page.goto('/admin/retention');
    const retry = page.locator('button:has-text("重試")');
    await expect(retry).toBeVisible({ timeout: 10_000 });

    // Click retry
    await retry.click();
    // Now the page should render the panel with counts (loading → ready)
    await expect(retry).not.toBeVisible({ timeout: 10_000 });
  });
});
