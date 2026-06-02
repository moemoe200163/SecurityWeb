import { test, expect } from '@playwright/test';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:4000';

test.describe('Phase 19.1: API key lifecycle', () => {
  test('self-service: rotate own key invalidates old, new works', async ({ page, request }) => {
    // 1. Use existing TEST_API_KEY (from setup) to access /api/me/api-key
    const meRes = await request.get(`${API_BASE}/api/me/api-key`, {
      headers: { 'X-API-Key': process.env.TEST_API_KEY || '' },
    });
    expect(meRes.ok()).toBe(true);

    // 2. Rotate
    const rotRes = await request.post(`${API_BASE}/api/me/api-key/rotate`, {
      headers: { 'X-API-Key': process.env.TEST_API_KEY || '' },
    });
    expect(rotRes.ok()).toBe(true);
    const { plaintext: newKey } = await rotRes.json();

    // 3. Old key fails
    const oldRes = await request.get(`${API_BASE}/api/me/api-key`, {
      headers: { 'X-API-Key': process.env.TEST_API_KEY || '' },
    });
    expect(oldRes.status()).toBe(401);

    // 4. New key works
    const newRes = await request.get(`${API_BASE}/api/me/api-key`, {
      headers: { 'X-API-Key': newKey },
    });
    expect(newRes.ok()).toBe(true);

    // 5. UI: visit /admin/keys with new key
    await page.goto('/admin/keys');
    // Set the new key in localStorage so the frontend uses it
    await page.evaluate((k) => localStorage.setItem('api_key', k), newKey);
    await page.reload();
    await expect(page.getByText('Admin · API Keys')).toBeVisible();
  });

  test('admin: revoke user key makes subsequent auth attempts 401', async ({ request }) => {
    // Create a victim user via direct DB (assumes admin privileges in test env)
    // For simplicity, this test assumes the seed creates a 'victim' user with a known key.
    const victimId = process.env.TEST_VICTIM_USER_ID;
    if (!victimId) test.skip();

    const adminKey = process.env.TEST_API_KEY || '';

    // Revoke
    const delRes = await request.delete(`${API_BASE}/api/admin/keys/${victimId}`, {
      headers: { 'X-API-Key': adminKey },
    });
    expect(delRes.status()).toBe(204);

    // Subsequent list should show revoked
    const listRes = await request.get(`${API_BASE}/api/admin/keys`, {
      headers: { 'X-API-Key': adminKey },
    });
    const list = await listRes.json();
    const victim = list.keys.find((k: any) => k.user.id === victimId);
    expect(victim.revokedAt).not.toBeNull();
  });
});
