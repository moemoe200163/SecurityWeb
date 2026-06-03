# Phase 21 Implementation Plan — Governance UI Consistency + P0 Test Stability

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship P0 retention test stability fix + 5 frontend governance page changes (PageHero migration × 2, RetentionPanel error states, rotate modal hardening × 2) + 2 Playwright E2E specs, with updated ACCEPTANCE/TODO docs.

**Architecture:** TDD where possible — write Playwright E2E first (RED), modify component (GREEN), commit. Backend P0 is a targeted test refactor (unique marker pattern). No new dependencies, no shared component extraction.

**Tech Stack:** Backend: vitest + Prisma + raw SQL (existing). Frontend: Next.js 16 + React 19 + lucide-react + Tailwind 4 (existing). E2E: Playwright 1.60 (existing).

**Spec:** `docs/superpowers/specs/2026-06-03-phase21-governance-ui-design.md`

**Important deviation from spec:** The spec mentions adding React Testing Library component tests (`.test.tsx`). The frontend has no vitest/RTL setup and adding it for 3 components is YAGNI. We drop those tests and rely on Playwright E2E for the same coverage. This is flagged here so the spec reviewer can update the spec if they disagree.

---

## File Structure

### Modified files (P0)

- `backend/tests/utils/retention.test.ts` — unique marker refactor

### Modified files (Phase 21)

- `frontend/src/app/admin/keys/page.tsx` — use PageHero, fetch stats for commandValue
- `frontend/src/app/admin/retention/page.tsx` — use PageHero, fetch lastRunAt for commandValue
- `frontend/src/components/admin/RetentionPanel.tsx` — three-state error UI
- `frontend/src/components/settings/MyApiKeyPanel.tsx` — remove Cancel, gate close on confirmation, hard-block ESC/backdrop
- `frontend/src/components/admin/UserKeyTable.tsx` — add confirmation checkbox, hard-block close

### New files (Phase 21)

- `frontend/e2e/admin-keys.spec.ts` — PageHero stats + rotate modal hardening
- `frontend/e2e/admin-retention.spec.ts` — PageHero lastRun + 403/500 error states
- `frontend/e2e/helpers/admin-auth.ts` — shared helpers (set localStorage api_key)

### Docs (P1 sync)

- `specs/ACCEPTANCE.md` — add Phase 21 section, update P0 evidence
- `specs/TODO.md` — mark Phase 21 done, add Phase 21.6 sub-task

---

## Task 1: P0 — Refactor retention test to use unique marker

**Files:**
- Modify: `backend/tests/utils/retention.test.ts`

### Background

`runRetentionCleanup` does table-wide `deleteMany({ where: { createdAt: { lt: cutoff } } })`. When retention.test.ts seeds a `'test_old'` audit log, a parallel file (e.g. adminRetention.test.ts) running retention with the same cutoff can delete it before our assertions complete. The test currently relies on `afterAll({ action: 'test_old' })` cleanup, which is too coarse to prevent intra-run race.

Fix: per-test unique marker stored in `auditLog.details.marker`. Look up and clean up only our own row.

- [ ] **Step 1: Read current test to understand exact seed shape**

Run: `cat /Users/user/Code/SecurityWeb/backend/tests/utils/retention.test.ts`
Expected: file matches what was already read; uses `seedOldAuditLog()` returning row id.

- [ ] **Step 2: Verify the failure mode by running the test in parallel 3 times**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
for i in 1 2 3; do
  echo "=== run $i ==="
  npx vitest run tests/utils/retention.test.ts 2>&1 | tail -5
done
```
Expected: All 3 runs pass currently (serial within a single file is fine; the race is between files). The race only manifests with full suite. **Do not try to reproduce the inter-file race here** — it's nondeterministic and slow. Trust the analysis: parallel-suite + table-wide deleteMany is the bug. Move on.

- [ ] **Step 3: Rewrite retention.test.ts to use unique marker**

Replace the entire file content:

```typescript
import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  runRetentionCleanup,
  type RetentionResult,
  type RetentionPreview,
} from '../../src/utils/retention.js';

const prisma = new PrismaClient();

/**
 * Seed an audit log row 100 days in the past with a unique marker
 * stored in `details.marker` so this test never collides with other
 * tests or with other retention runs in the same suite.
 *
 * Uses raw SQL to bypass Prisma's @default(now()) on createdAt.
 */
async function seedOldAuditLog(marker: string): Promise<string> {
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  const iso = oldDate.toISOString();
  const details: Prisma.InputJsonValue = { marker, test: 'retention-marker' };
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, details, "createdAt")
     VALUES (gen_random_uuid(), 'test-admin', 'test_old', 'test', $1::jsonb, $2::timestamptz)
     RETURNING id`,
    JSON.stringify(details),
    iso,
  );
  return rows[0].id;
}

async function findByMarker(marker: string): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM audit_logs WHERE details->>'marker' = $1 LIMIT 1`,
    marker,
  );
  return rows[0] ?? null;
}

async function deleteByMarker(marker: string): Promise<void> {
  await prisma.$queryRawUnsafe(
    `DELETE FROM audit_logs WHERE details->>'marker' = $1`,
    marker,
  );
}

afterAll(async () => {
  // Best-effort: also clean up any stragglers from interrupted runs
  await prisma.$queryRawUnsafe(
    `DELETE FROM audit_logs WHERE details->>'test' = 'retention-marker'`,
  );
  await prisma.$disconnect();
});

afterEach(async () => {
  // Per-test cleanup marker tracked via closure (see individual tests)
});

describe('runRetentionCleanup', () => {
  it('default mode is execute (backward compat)', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    try {
      const result = await runRetentionCleanup({ auditLogDays: 90 });
      expect(typeof (result as RetentionResult).auditLogsDeleted).toBe('number');
    } finally {
      await deleteByMarker(marker);
    }
    // id is referenced to satisfy linter when seed succeeded
    expect(id).toBeTruthy();
  });

  it('mode=preview returns counts without mutating own row', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    try {
      const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'preview' })) as RetentionPreview;
      expect(result.auditLogsWouldDelete).toBeGreaterThanOrEqual(1);

      // Our specific row must still exist after preview, regardless of
      // what other tests have seeded in the same suite.
      const stillThere = await findByMarker(marker);
      expect(stillThere?.id).toBe(id);
    } finally {
      await deleteByMarker(marker);
    }
  });

  it('mode=execute deletes our seeded row', async () => {
    const marker = randomUUID();
    const id = await seedOldAuditLog(marker);
    const before = await findByMarker(marker);
    expect(before?.id).toBe(id);

    const result = (await runRetentionCleanup({ auditLogDays: 90, mode: 'execute' })) as RetentionResult;
    expect(result.auditLogsDeleted).toBeGreaterThanOrEqual(1);

    const after = await findByMarker(marker);
    expect(after).toBeNull();
  });
});
```

Key changes vs original:
- Per-test `marker = randomUUID()` instead of shared `action: 'test_old'`
- Seed writes marker into `details.marker` (raw SQL `jsonb`)
- Look up by `details->>'marker'` (raw SQL JSONB operator) instead of by `id`+fallback
- Cleanup is per-test in `finally` + best-effort `afterAll`
- Test 3 (execute) removed the `findUnique({id})` lookup; uses marker-based lookup which is race-safe
- Imports added: `randomUUID`, `Prisma` type, `afterEach` (kept for symmetry even if unused)

- [ ] **Step 4: Run the rewritten test in isolation to verify it still passes**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
npx vitest run tests/utils/retention.test.ts 2>&1 | tail -15
```
Expected: `3 passed` in retention.test.ts.

- [ ] **Step 5: Run the full backend test suite WITHOUT `--fileParallelism` to verify P0 fix**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
npm test 2>&1 | tail -10
```
Expected: `Test Files  5 passed (5)` and `Tests  54 passed (54)`. No flaky failures.

- [ ] **Step 6: Run the full backend test suite 3 more times to confirm stability**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | grep -E "Test Files|Tests" | head -2
done
```
Expected: All 3 runs show `54 passed (54)`.

- [ ] **Step 7: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add backend/tests/utils/retention.test.ts
git commit -m "$(cat <<'EOF'
fix(tests): P0 — retention test uses unique marker to avoid parallel-suite race

The previous test seeded audit logs with a shared action='test_old' marker
and asserted on row id. When other test files (e.g. adminRetention) run
retention cleanup in parallel, the table-wide deleteMany can remove our
seeded row before our assertions complete.

Per-test randomUUID stored in details.marker (JSONB) means our seed and
cleanup touch only our own row, regardless of what other tests do.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Phase 21.6 — Create Playwright auth helper

**Files:**
- Create: `frontend/e2e/helpers/admin-auth.ts`

The Phase 21 E2E specs both need to set a valid admin API key in `localStorage` before navigating. Centralize the helper here to keep specs readable.

- [ ] **Step 1: Create the helper file**

Create `frontend/e2e/helpers/admin-auth.ts` with content:

```typescript
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
```

- [ ] **Step 2: Verify helper compiles (no test, just typecheck)**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npx tsc --noEmit e2e/helpers/admin-auth.ts 2>&1 | tail -20
```
Expected: no output (TypeScript clean). If there are errors about missing types, the project may need `@playwright/test` reachable — confirm with `ls node_modules/@playwright/test` and report back if it fails.

- [ ] **Step 3: Commit (defer commit to Task 7 when used by specs)**

Skip — commit together with the first spec that uses it.

---

## Task 3: Phase 21.1 — Migrate `/admin/keys` to PageHero

**Files:**
- Modify: `frontend/src/app/admin/keys/page.tsx`

- [ ] **Step 1: Read current page to confirm shape**

Run: `cat /Users/user/Code/SecurityWeb/frontend/src/app/admin/keys/page.tsx`
Expected: matches the file already read — inline `<header>` + `<h1>` + `<p>` + `<Link>` + `<UserKeyTable />`.

- [ ] **Step 2: Replace page.tsx with PageHero-based version**

Write the following to `frontend/src/app/admin/keys/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { UserKeyTable } from '@/components/admin/UserKeyTable';
import { api } from '@/lib/api';

interface KeyStats {
  active: number;
  revoked: number;
  noKey: number;
}

export default function AdminKeysPage() {
  const [stats, setStats] = useState<KeyStats | null>(null);

  useEffect(() => {
    api.adminKeys
      .list()
      .then((res) => {
        const keys = res.keys;
        setStats({
          active: keys.filter((k) => !k.revokedAt && k.prefix).length,
          revoked: keys.filter((k) => k.revokedAt).length,
          noKey: keys.filter((k) => !k.revokedAt && !k.prefix).length,
        });
      })
      .catch(() => setStats({ active: 0, revoked: 0, noKey: 0 }));
  }, []);

  const commandValue = stats
    ? `${stats.active} active · ${stats.revoked} revoked · ${stats.noKey} no-key`
    : 'loading...';

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<KeyRound className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · API Keys"
        subtitle="USER KEY MANAGEMENT"
        command="admin keys list --filter=active"
        commandValue={commandValue}
        actions={
          <Link
            href="/admin/retention"
            className="text-sm font-mono text-[var(--terminal-green)] hover:underline"
          >
            Go to Retention →
          </Link>
        }
      />
      <div className="max-w-5xl mx-auto p-6">
        <UserKeyTable />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the file compiles via frontend build**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run build 2>&1 | tail -20
```
Expected: build succeeds, no TypeScript errors. Look for `admin/keys` in the route table.

- [ ] **Step 4: Verify lint passes**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -10
```
Expected: 0 errors. Warnings about existing code are fine.

- [ ] **Step 5: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/src/app/admin/keys/page.tsx
git commit -m "$(cat <<'EOF'
refactor(admin): migrate /admin/keys to shared PageHero

PageHero commandValue shows live active/revoked/no-key counts fetched
from /api/admin/keys. Link to /admin/retention moved to actions slot
to match the layout used by /settings, /tools, /alerts.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Phase 21.2 — Migrate `/admin/retention` to PageHero

**Files:**
- Modify: `frontend/src/app/admin/retention/page.tsx`

- [ ] **Step 1: Replace page.tsx with PageHero-based version**

Write the following to `frontend/src/app/admin/retention/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { RetentionPanel } from '@/components/admin/RetentionPanel';
import { api } from '@/lib/api';

export default function AdminRetentionPage() {
  const [lastRunAt, setLastRunAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api.adminRetention
      .status()
      .then((res) => setLastRunAt(res.lastRunAt))
      .catch(() => setLastRunAt(null));
  }, []);

  const commandValue =
    lastRunAt === undefined
      ? 'loading...'
      : lastRunAt === null
        ? 'never'
        : new Date(lastRunAt).toLocaleString();

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Database className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · Retention"
        subtitle="DATA RETENTION MANAGEMENT"
        command="retention status --last-run"
        commandValue={commandValue}
        actions={
          <Link
            href="/admin/keys"
            className="text-sm font-mono text-[var(--terminal-green)] hover:underline"
          >
            ← Back to API keys
          </Link>
        }
      />
      <div className="max-w-5xl mx-auto p-6">
        <RetentionPanel />
      </div>
    </main>
  );
}
```

Notes:
- `lastRunAt === undefined` means "still loading"
- `lastRunAt === null` means "no run recorded" → display 'never'
- `lastRunAt === string` → display formatted timestamp

- [ ] **Step 2: Verify the file compiles via frontend build**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run build 2>&1 | tail -20
```
Expected: build succeeds.

- [ ] **Step 3: Verify lint passes**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/src/app/admin/retention/page.tsx
git commit -m "$(cat <<'EOF'
refactor(admin): migrate /admin/retention to shared PageHero

PageHero commandValue shows last-run timestamp or 'never' fetched from
/api/admin/retention/status. Link to /admin/keys moved to actions slot.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Phase 21.3 — Add three-state error UI to RetentionPanel

**Files:**
- Modify: `frontend/src/components/admin/RetentionPanel.tsx`

- [ ] **Step 1: Add imports for ApiKeyRequired, ApiError, and a new error-state icon**

In `frontend/src/components/admin/RetentionPanel.tsx`, replace the imports section (top of file, lines 1-6) with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Play, Eye, AlertCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
import Link from 'next/link';
```

- [ ] **Step 2: Add error-state type and helper after the existing interface definitions**

Insert immediately after the `Preview` interface (after the closing `}` of `interface Preview`), before `export function RetentionPanel()`:

```tsx
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; type: 'auth' | 'forbidden' | 'server'; message: string };

function classifyError(e: unknown): { type: 'auth' | 'forbidden' | 'server'; message: string } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { type: 'auth', message: '需要 API Key 才能繼續' };
    if (e.status === 403) return { type: 'forbidden', message: '需要管理員權限' };
    return { type: 'server', message: e.message };
  }
  return { type: 'server', message: '網路錯誤，請稍後重試' };
}
```

- [ ] **Step 3: Replace loading state declarations to use LoadState**

Find the `useState` declarations around line 21-26 (the block that starts with `const [status, setStatus] = useState<Status | null>(null);` and ends with `const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);`).

Replace just the first two state lines with:

```tsx
  const [status, setStatus] = useState<Status | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [running, setRunning] = useState(false);
```

(Keep `running`, `preview`, `showConfirm`, `toast` lines unchanged.)

- [ ] **Step 4: Update the `load` function to set loadState on success/failure**

Find the `load` function (lines 28-35):

```tsx
  const load = async () => {
    setLoading(true);
    try {
      setStatus(await api.adminRetention.status());
    } finally {
      setLoading(false);
    }
  };
```

Replace it with:

```tsx
  const load = async () => {
    setLoadState({ kind: 'loading' });
    try {
      setStatus(await api.adminRetention.status());
      setLoadState({ kind: 'ready' });
    } catch (e) {
      setLoadState({ kind: 'error', ...classifyError(e) });
    }
  };
```

- [ ] **Step 5: Update `handleDryRun` and `handleConfirmRun` to use classifyError for the toast message**

In `handleDryRun` (around line 39-46), the catch block:

```tsx
    } catch (e) {
      setToast({ kind: 'err', msg: (e as Error).message });
    }
```

Replace with:

```tsx
    } catch (e) {
      const { message } = classifyError(e);
      setToast({ kind: 'err', msg: message });
    }
```

In `handleConfirmRun` (around line 68-72), the catch block:

```tsx
    } catch (e) {
      setToast({ kind: 'err', msg: (e as Error).message });
    }
```

Replace with:

```tsx
    } catch (e) {
      const { message } = classifyError(e);
      setToast({ kind: 'err', msg: message });
    }
```

- [ ] **Step 6: Replace the loading/early-return guard at the top of the render with three-state handling**

Find the line:

```tsx
  if (loading || !status) return <div className="text-sm text-muted-foreground">Loading retention status...</div>;
```

Replace it with:

```tsx
  if (loadState.kind === 'loading') {
    return <div className="text-sm text-muted-foreground">Loading retention status...</div>;
  }

  if (loadState.kind === 'error' && loadState.type === 'auth') {
    return <ApiKeyRequired />;
  }

  if (loadState.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-[var(--terminal-amber)]/30 bg-[var(--terminal-amber)]/5 p-6 space-y-3"
      >
        <div className="flex items-center gap-2 text-[var(--terminal-amber)]">
          {loadState.type === 'forbidden' ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <h3 className="font-mono text-sm">
            {loadState.type === 'forbidden' ? '需要管理員權限' : '無法載入 retention 狀態'}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{loadState.message}</p>
        <div className="flex gap-2">
          {loadState.type === 'forbidden' ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--terminal-green)]/50 text-sm"
            >
              前往設定
            </Link>
          ) : (
            <button
              onClick={load}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black hover:opacity-90 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> 重試
            </button>
          )}
        </div>
      </div>
    );
  }

  // loadState.kind === 'ready' but status may still be null on first render
  if (!status) return null;
```

- [ ] **Step 7: Verify the file compiles and lints**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10
```
Expected: 0 lint errors, build succeeds. There will likely be a warning about the now-unused `loading` state variable — that's fine (declared but not referenced; we removed the only consumer). If linting flags it as an error, remove the `const [loading, setLoading] = useState(true);` line as well.

If `loading` is flagged unused, remove it: delete the line `const [loading, setLoading] = useState(true);` and rerun.

- [ ] **Step 8: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/src/components/admin/RetentionPanel.tsx
git commit -m "$(cat <<'EOF'
feat(admin): add three-state error UI to RetentionPanel

- 401: render <ApiKeyRequired /> (full-page swap, matches other pages)
- 403: inline '需要管理員權限' block with link to /settings
- 500/network: inline error block with Retry button that re-calls load()

Previously, a failed status() call would leave the panel stuck on
'Loading retention status...' forever. Now the user sees actionable
feedback and can recover.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Phase 21.4 — Harden MyApiKeyPanel rotate modal (no direct cancel)

**Files:**
- Modify: `frontend/src/components/settings/MyApiKeyPanel.tsx`

- [ ] **Step 1: Add a keydown handler to block Escape**

In `frontend/src/components/settings/MyApiKeyPanel.tsx`, find the imports at the top:

```tsx
import { useState, useEffect } from 'react';
```

Replace with:

```tsx
import { useState, useEffect, useCallback } from 'react';
```

- [ ] **Step 2: Add `closeModal` callback after the existing `handleClearLocal` function**

Find the `handleClearLocal` function (around line 71-76) and add `closeModal` immediately after it (still inside the component):

```tsx
  const closeModal = useCallback(() => {
    setNewPlaintext(null);
    setConfirmed(false);
  }, []);

  useEffect(() => {
    if (!newPlaintext) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Hard block: cancel the Escape so browser doesn't close anything else either
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [newPlaintext]);
```

- [ ] **Step 3: Update `handleConfirm` to use `closeModal`**

Find `handleConfirm`:

```tsx
  const handleConfirm = () => {
    if (newPlaintext && confirmed) {
      setApiKey(newPlaintext);
      setNewPlaintext(null);
      setConfirmed(false);
    }
  };
```

Replace with:

```tsx
  const handleConfirm = () => {
    if (newPlaintext && confirmed) {
      setApiKey(newPlaintext);
      closeModal();
    }
  };
```

- [ ] **Step 4: Replace the modal markup to remove Cancel, gate Done on confirmed, and hard-block backdrop**

Find the modal block (around line 134-176). Replace it entirely with:

```tsx
      {newPlaintext && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rotate-modal-title"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="rotate-modal-title" className="font-bold text-lg">Save your new API key</h4>
            <p className="text-sm text-muted-foreground">
              This is the only time you will see this key. Copy it now and store it securely.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-black/40 font-mono text-sm break-all">
              <code className="flex-1">{newPlaintext}</code>
              <button
                onClick={() => navigator.clipboard.writeText(newPlaintext)}
                className="p-1 hover:text-[var(--terminal-green)]"
                aria-label="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                aria-label="Confirm I have saved this key"
              />
              I have saved this key
            </label>
            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={!confirmed}
                className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50"
              >
                I&apos;ve saved — close
              </button>
            </div>
          </div>
        </div>
      )}
```

Key changes:
- Removed the "Cancel" button entirely
- Renamed "Activate new key" to "I've saved — close" (no longer activates because `setApiKey` was already happening in `handleConfirm`; the close is the only remaining action after save)
- Backdrop click: hard-blocked (no `onClick` on outer div). Inner card stops propagation so clicking the card content doesn't bubble.
- Escape: hard-blocked via global keydown listener with `preventDefault` + `stopPropagation` in capture phase.
- Added `role="dialog"` + `aria-modal="true"` for a11y.

- [ ] **Step 5: Verify the file lints and builds**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10
```
Expected: 0 lint errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/src/components/settings/MyApiKeyPanel.tsx
git commit -m "$(cat <<'EOF'
feat(admin): harden MyApiKeyPanel rotate modal — no direct cancel

Remove the standalone Cancel button. Replace the close action with a
single "I've saved — close" button that's disabled until the user
checks "I have saved this key". Backdrop click and Escape key are
hard-blocked (no-op) until the checkbox is checked.

Previously, a user could close the modal with one click and lose the
only copy of their plaintext key forever.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Phase 21.5 — Harden UserKeyTable rotate modal (admin)

**Files:**
- Modify: `frontend/src/components/admin/UserKeyTable.tsx`

- [ ] **Step 1: Add `useEffect`/`useCallback` imports**

Find the imports at the top:

```tsx
import { useState, useEffect } from 'react';
```

Replace with:

```tsx
import { useState, useEffect, useCallback } from 'react';
```

- [ ] **Step 2: Add a `confirmed` state and `closeModal` callback**

Find the existing `useState` declarations (around line 16-19). After the existing `useState` lines, add:

```tsx
  const [confirmed, setConfirmed] = useState(false);

  const closeModal = useCallback(() => {
    setPlaintextFor(null);
    setConfirmed(false);
  }, []);
```

- [ ] **Step 3: Add the Escape hard-block effect after the existing `useEffect(() => { load(); }, [])` block**

Find the existing useEffect that calls `load()` on mount, and add the Escape handler immediately after it:

```tsx
  useEffect(() => {
    if (!plaintextFor) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [plaintextFor]);
```

- [ ] **Step 4: Replace the modal markup with the hardened version**

Find the modal block (around line 120-147). Replace it entirely with:

```tsx
      {plaintextFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-rotate-modal-title"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="admin-rotate-modal-title" className="font-bold text-lg">New key generated</h4>
            <p className="text-sm text-muted-foreground">
              Copy this key and deliver it to the user. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-black/40 font-mono text-sm break-all">
              <code className="flex-1">{plaintextFor.plaintext}</code>
              <button
                onClick={() => navigator.clipboard.writeText(plaintextFor.plaintext)}
                className="p-1 hover:text-[var(--terminal-green)]"
                aria-label="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                aria-label="Confirm key delivered to user"
              />
              I have delivered this key to the user
            </label>
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                disabled={!confirmed}
                className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
```

Key changes:
- Added `confirmed` state (was missing entirely)
- Added checkbox "I have delivered this key to the user"
- Done button is disabled until confirmed
- Backdrop click hard-blocked (no `onClick` on outer div)
- Escape hard-blocked via global keydown listener
- Added ARIA attributes for a11y

- [ ] **Step 5: Verify lint and build**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/src/components/admin/UserKeyTable.tsx
git commit -m "$(cat <<'EOF'
feat(admin): harden UserKeyTable rotate modal — require delivery confirmation

Add a "I have delivered this key to the user" checkbox. The Done
button is disabled until it's checked. Backdrop click and Escape
are hard-blocked (no-op) until confirmation.

Previously, an admin could rotate a user's key, see the plaintext,
and close the modal in one click — losing the only copy before
delivering it to the user.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Phase 21.6 — Write E2E spec for `/admin/keys`

**Files:**
- Create: `frontend/e2e/admin-keys.spec.ts`
- Use: `frontend/e2e/helpers/admin-auth.ts`

- [ ] **Step 1: Write the E2E spec (RED — verifies current state, expects failures for the new behaviors)**

Create `frontend/e2e/admin-keys.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run the spec against the current code to confirm RED state for the modal test**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
# Start backend + frontend dev server in the background or rely on playwright's webServer
npx playwright test e2e/admin-keys.spec.ts --reporter=list 2>&1 | tail -40
```
Expected: The "PageHero shows key statistics" and "PageHero shows loading..." tests should pass (we already implemented those). The "rotate modal cannot close" test should fail because the current code has no checkbox on the admin modal (the current implementation has only a Done button that's always enabled).

If the first two tests fail instead, the dev server may not have admin seed data — check the database state and report. The third test must fail to confirm we're testing the new behavior.

- [ ] **Step 3: Run the full spec — expect GREEN for all three after our changes**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npx playwright test e2e/admin-keys.spec.ts --reporter=list 2>&1 | tail -20
```
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/e2e/admin-keys.spec.ts frontend/e2e/helpers/admin-auth.ts
git commit -m "$(cat <<'EOF'
test(e2e): add admin-keys spec — PageHero stats + modal hardening

- PageHero commandValue pattern check
- loading... fallback before stats arrive
- rotate modal hard-blocked until 'I have delivered' is checked
  (backdrop click, Escape, and Done button all gated)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Phase 21.6 — Write E2E spec for `/admin/retention`

**Files:**
- Create: `frontend/e2e/admin-retention.spec.ts`
- Use: `frontend/e2e/helpers/admin-auth.ts`

- [ ] **Step 1: Write the E2E spec**

Create `frontend/e2e/admin-retention.spec.ts`:

```typescript
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
    const never = page.locator('text="never"');
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
    // that "never" is absent and that some year prefix is present.
    await expect(page.locator('text=/202[0-9]/')).toBeVisible({ timeout: 10_000 });
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
    await expect(page.locator('text=/需要管理員權限/')).toBeVisible({ timeout: 10_000 });
    // Has a link to settings
    await expect(page.locator('a[href="/settings"]')).toBeVisible();
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
```

- [ ] **Step 2: Run the spec**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npx playwright test e2e/admin-retention.spec.ts --reporter=list 2>&1 | tail -40
```
Expected: All 5 tests pass.

If `render <ApiKeyRequired /> when API key is missing` fails because the component shows different text, run the dev server and visit `/admin/retention` without an API key to check what heading is shown. Update the regex `/API Key/i` accordingly (e.g., `/API\s*Key/i` or include the actual phrase).

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Code/SecurityWeb
git add frontend/e2e/admin-retention.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add admin-retention spec — PageHero + error states

- 'never' fallback when no retention has run
- timestamp fallback when lastRunAt is set
- 401 path renders ApiKeyRequired
- 403 path shows forbidden state with link to /settings
- 500 path shows retry button that recovers on next call

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Run the full test suite end-to-end

- [ ] **Step 1: Run all backend tests**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
npm test 2>&1 | tail -10
```
Expected: `Test Files 5 passed` and `Tests 54 passed`.

- [ ] **Step 2: Run all frontend Playwright specs**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npx playwright test --reporter=list 2>&1 | tail -30
```
Expected: All existing specs (smoke, api-key-lifecycle) + new admin-keys (3) + admin-retention (5) pass. Total: ~14-15 tests.

- [ ] **Step 3: Run frontend lint and build**

Run:
```bash
cd /Users/user/Code/SecurityWeb/frontend
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -10
```
Expected: 0 lint errors, build succeeds.

- [ ] **Step 4: Run backend build**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
npm run build 2>&1 | tail -10
```
Expected: tsc clean.

- [ ] **Step 5: Capture evidence commands for ACCEPTANCE.md update**

Run:
```bash
cd /Users/user/Code/SecurityWeb/backend
npm test 2>&1 | tail -5
cd /Users/user/Code/SecurityWeb/frontend
npx playwright test --reporter=list 2>&1 | tail -20
```
Expected output (capture for docs):
- Backend: `Test Files 5 passed (5)` / `Tests 54 passed (54)`
- Playwright: count of passed tests across all specs

---

## Task 11: Update ACCEPTANCE.md and TODO.md

**Files:**
- Modify: `specs/ACCEPTANCE.md`
- Modify: `specs/TODO.md`

- [ ] **Step 1: Update ACCEPTANCE.md — replace backend test count evidence**

Find the row:
```
| `npm test` (= `vitest run`) 全綠 | **PASS** | 54/54 passed（23 api + 5 adminRetention + 3 retention + 其他） |
```

Replace with:
```
| `npm test` (= `vitest run`) 全綠 | **PASS** | 54/54 passed — `npm test`（預設 `vitest run` 平行）穩定；retention.test.ts 用 unique marker 避免平行 race（Phase 21 P0） |
```

- [ ] **Step 2: Update ACCEPTANCE.md — add Phase 21 section**

Find the existing Phase 19 sections (## 11, ## 12, ## 13) and add a new section after them:

```markdown
## 14. Phase 21: 前端治理頁一致化

| 項目 | 狀態 | 證據 |
|------|------|------|
| `/admin/keys` 改用共用 `PageHero` | **PASS** | `frontend/src/app/admin/keys/page.tsx` 使用 `<PageHero>`，command 顯示「{n} active · {n} revoked · {n} no-key」 |
| `/admin/retention` 改用共用 `PageHero` | **PASS** | `frontend/src/app/admin/retention/page.tsx` 使用 `<PageHero>`，command 顯示 `lastRunAt` 或 `never` |
| `RetentionPanel` 401 → `ApiKeyRequired` | **PASS** | 三狀態 error UI，401 整頁換 `<ApiKeyRequired />` |
| `RetentionPanel` 403 → forbidden inline | **PASS** | 顯示「需要管理員權限」+ 連結到 `/settings` |
| `RetentionPanel` 500 → retry | **PASS** | 顯示錯誤區塊 + Retry 按鈕（重試成功） |
| `MyApiKeyPanel` rotate modal 禁止直接 cancel | **PASS** | 移除 Cancel 按鈕；backdrop/ESC hard-block；唯一關閉路徑是勾選「I have saved」後按「I've saved — close」 |
| `UserKeyTable` rotate modal 硬化 | **PASS** | 加「I have delivered this key to the user」checkbox；Done 按鈕 disabled 直到勾選 |
| Playwright E2E `admin-keys.spec.ts` | **PASS** | 3 個 test 全綠 |
| Playwright E2E `admin-retention.spec.ts` | **PASS** | 5 個 test 全綠（PageHero + 401/403/500） |
```

- [ ] **Step 3: Update TODO.md — mark Phase 21 done and add Phase 21.6 sub-task**

Find:
```
### Phase 21: 前端治理頁一致化 `[ ]`
- [ ] /admin/keys、/admin/retention 補上共用 PageHero 與一致的 Hero Bar
- [ ] RetentionPanel 補 401/403/錯誤狀態 UI（不只 loading）
- [ ] API key rotate modal 禁止直接 cancel，改為明確「我已保存」後才能關閉
```

Replace with:
```
### Phase 21: 前端治理頁一致化 `[x]`
- [x] /admin/keys、/admin/retention 補上共用 PageHero 與一致的 Hero Bar
- [x] RetentionPanel 補 401/403/錯誤狀態 UI（不只 loading）
- [x] API key rotate modal 禁止直接 cancel，改為明確「我已保存」後才能關閉
- [x] P0 修：retention.test.ts 改用 unique marker，讓 `npm test` 與 `npx vitest run` 都穩定
- [x] Playwright E2E：admin-keys.spec.ts + admin-retention.spec.ts 覆蓋 PageHero 與錯誤狀態
```

- [ ] **Step 4: Commit docs**

```bash
cd /Users/user/Code/SecurityWeb
git add specs/ACCEPTANCE.md specs/TODO.md
git commit -m "$(cat <<'EOF'
docs: Phase 21 acceptance + TODO updates

- ACCEPTANCE.md: add Phase 21 section (14) + update P0 evidence
  (54/54 stable under default vitest run after unique marker fix)
- TODO.md: mark Phase 21 done, sub-items include P0 fix and E2E

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- P0 retention test marker refactor → Task 1
- Phase 21.1 /admin/keys PageHero → Task 3
- Phase 21.2 /admin/retention PageHero → Task 4
- Phase 21.3 RetentionPanel three-state error → Task 5
- Phase 21.4 MyApiKeyPanel modal hardening → Task 6
- Phase 21.5 UserKeyTable modal hardening → Task 7
- Phase 21.6 E2E → Tasks 8 + 9
- ACCEPTANCE.md / TODO.md sync → Task 11
- Final verification → Task 10
- Spec's mention of RTL component tests is **dropped** (no setup in repo); Playwright E2E provides equivalent coverage. Documented in header.

**2. Placeholder scan:** No TBDs. All code blocks are complete. All commands have expected output.

**3. Type consistency:**
- `api.adminKeys.list()` — used in Tasks 3 and 8. Type confirmed in api.ts: returns `{ keys: Array<{prefix, createdAt, revokedAt, expiresAt, user: {id, email, role}}> }`.
- `api.adminRetention.status()` — used in Tasks 4 and 9. Type confirmed.
- `ApiError` — used in Task 5. Confirmed export from `@/lib/api`.
- `ApiKeyRequired` — used in Task 5. Confirmed path `@/components/ui/ApiKeyRequired`.
- `PageHero` props — `icon, title, subtitle, command, commandValue, actions`. Matches Task 3 and 4.
- `randomUUID` from `node:crypto` — used in Task 1. Compatible with backend ESM ("type": "module" in package.json).

**4. Task ordering:** P0 (Task 1) must run first to unblock honest acceptance testing. Tasks 3-7 can be reordered within themselves, but the dependency chain is: P0 → Tasks 3-7 (independent) → Tasks 8-9 (test the changes) → Task 10 (verify) → Task 11 (docs).
