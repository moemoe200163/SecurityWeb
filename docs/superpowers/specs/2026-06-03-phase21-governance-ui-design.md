# Phase 21 — 前端治理頁一致化 + P0 測試穩定化

## Overview

讓治理頁（`/admin/keys`、`/admin/retention`）與其他工作流頁面視覺一致；硬化 API key rotate modal 防止明文 key 因為誤按 Cancel 而遺失；補齊 `RetentionPanel` 缺失的錯誤狀態 UI。在此之前先修一個 P0：`npx vitest run` 預設會因 retention 測試 race 失敗，必須靠 `--fileParallelism=false` 才能過。P0 與 Phase 21 一起處理，因為改完 4 個前端檔案後，下一個開發者跑 `npm test` 不能被誤導成「全綠」。

**Out of scope**:
- 共用 `<SaveKeyModal>`、`<ErrorState>`、`<ConfirmDialog>` 元件抽取（留到 Phase 22+ 觀察是否真有 5+ 個場景）
- 全站 modal a11y 重構（focus trap、aria-modal）
- i18n（仍維持繁中）
- Retention policy UI 化（policy 值繼續 hardcoded）

## Goals

1. `npm test` 與 `npx vitest run` 兩種呼叫方式都穩定 54/54 PASS，**不靠人工加 `--fileParallelism=false`**。
2. `/admin/keys` 與 `/admin/retention` 視覺與其他工作流頁（settings、tools、alerts）一致：共用 `PageHero`、一致的 Hero Bar 高度與樣式。
3. `RetentionPanel` 在 `load()`、`handleDryRun`、`handleConfirmRun` 三處失敗時，分別顯示對應的錯誤狀態（401 / 403 / 500+network）。
4. `MyApiKeyPanel` 與 `UserKeyTable` 的 rotate modal 必須勾選「我已保存 / 已交付給使用者」才能關閉（含 ESC、backdrop click、Close 按鈕）。
5. 新增 Playwright E2E 覆蓋上述三個 UI 行為，避免日後 refactor 退場。

## Non-goals

- 共用 modal/error 元件抽象（YAGNI：目前只有 2 個 rotate modal 場景，抽元件反而增加閱讀成本）
- 完整 a11y 重構（focus trap、aria-modal 留待日後 modal 數量到 5+ 再做）
- 自動重試 5xx（手動 Retry 按鈕就夠，避免無聲重試干擾用戶）
- Toast 自動消失時間統一（維持手動 × 按鈕，避免訊息太快被用戶忽略）

---

## P0 — 測試穩定化（pre-requisite）

### 問題陳述

`backend/tests/utils/retention.test.ts` 與其他會 touch `audit_log` 資料表的測試在平行執行時會互相干擾。`runRetentionCleanup` 是全表清理（`prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })`），不限 `action`。當 retention 測試 seed 了一筆 `'test_old'` audit log，平行跑的 `adminRetention.test.ts` 觸發的 retention run 可能先把這筆刪掉，導致 retention 測試的「應被刪除 / 應仍在」斷言 flaky。

`ACCEPTANCE.md` 寫的「54/54 PASS」證據目前只來自 `npx vitest run --fileParallelism=false`；預設的 `npx vitest run` 不穩定。文件與實際脫節。

### 修法：Unique Marker

`backend/tests/utils/retention.test.ts` 改為：

- 每個 test 用 `crypto.randomUUID()` 產生 `marker`（如 `'test-retention-3f8a1b...'`
- 寫入 `auditLog.details` 的 `JSONB` 欄位（Prisma 可寫、可讀、保留現有 `action: 'test_old'`）
- 改用 `where: { details: { path: ['marker'], equals: marker } }` 來定位自己的 row
- 刪除時也只刪自己的 row，不動全表
- 斷言改為：
  - 「seed 後 row 存在」：用 unique marker 查
  - 「preview 不刪除」：seed 後查 marker，verify 仍在
  - 「execute 刪除」：seed → 跑 retention → 查 marker，verify 變 null

### 為何不選其他方案

- **vitest.config.ts 預設 `fileParallelism: false`**：1 行設定，但 54 個測試全序列；CI 跑時間多 30-50%
- **Per-file transaction**：要改 `tests/setup.ts` + 所有依賴 DB 的測試（影響 5+ 個檔案），風險大
- **Unique marker**：只動 retention.test.ts（1 個檔案），保留平行速度與既有測試

---

## Phase 21.1 — PageHero 一致化（`/admin/keys`）

### 現況

`frontend/src/app/admin/keys/page.tsx` 用手寫 `<header>` + `<h1>` + `<p>`，跟其他工作流頁面（settings、tools、alerts）不一致。

### 修改

改用共用 `PageHero` 元件，動態 command 顯示 active / revoked / no-key 統計：

```tsx
// frontend/src/app/admin/keys/page.tsx (修改後)
'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { UserKeyTable } from '@/components/admin/UserKeyTable';
import { api } from '@/lib/api';
import Link from 'next/link';

interface KeyStats { active: number; revoked: number; noKey: number }

export default function AdminKeysPage() {
  const [stats, setStats] = useState<KeyStats | null>(null);

  useEffect(() => {
    api.adminKeys.list()
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

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<KeyRound className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · API Keys"
        subtitle="USER KEY MANAGEMENT"
        command="admin keys list --filter=active"
        commandValue={stats ? `${stats.active} active · ${stats.revoked} revoked · ${stats.noKey} no-key` : 'loading...'}
        actions={
          <Link href="/admin/retention" className="text-sm font-mono text-[var(--terminal-green)] hover:underline">
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

注意：原本頁面把 link `<Link href="/admin/retention">` 放在 subtitle 後；移到 `actions` 區塊，視覺上跟 settings 頁的 PageHero 結構對齊。

---

## Phase 21.2 — PageHero 一致化（`/admin/retention`）

### 修改

```tsx
// frontend/src/app/admin/retention/page.tsx (修改後)
'use client';

import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { RetentionPanel } from '@/components/admin/RetentionPanel';
import { api } from '@/lib/api';
import Link from 'next/link';

interface LastRun { at: string | null }

export default function AdminRetentionPage() {
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  useEffect(() => {
    api.adminRetention.status()
      .then((res) => setLastRun({ at: res.lastRunAt }))
      .catch(() => setLastRun({ at: null }));
  }, []);

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Database className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · Retention"
        subtitle="DATA RETENTION MANAGEMENT"
        command="retention status --last-run"
        commandValue={lastRun ? (lastRun.at ? new Date(lastRun.at).toLocaleString() : 'never') : 'loading...'}
        actions={
          <Link href="/admin/keys" className="text-sm font-mono text-[var(--terminal-green)] hover:underline">
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

### 重複請求疑慮

`/admin/retention` 頁面會做兩次 GET `/api/admin/retention/status`：PageHero 的 `useEffect` + `RetentionPanel` 的 `load()`。可接受：
- 第二次請求會被 304 cache 處理（若 backend 有 ETag）
- 即使兩次都打 DB，也是 2 個簡單 count query，不影響 UX
- 為 YAGNI 不抽共用 hook（先求能跑，未來若有 N+1 問題再說）

---

## Phase 21.3 — RetentionPanel 錯誤狀態

### 現況

`frontend/src/components/admin/RetentionPanel.tsx`：
- `load()` 用 `try/finally`，沒有 catch：若 status 查詢失敗，`status` 維持 null，UI 卡在 "Loading retention status..." 永遠不動
- `handleDryRun` 與 `handleConfirmRun` 有 catch，但只設 toast，沒有區分錯誤類型
- 沒有 401/403 區分；缺 API key 不會被擋到這一頁

### 修改

```tsx
// 新增 state 區分錯誤類型
type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; type: 'auth' | 'forbidden' | 'server'; message: string };

const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });

const load = async () => {
  setLoadState({ kind: 'loading' });
  try {
    setStatus(await api.adminRetention.status());
    setLoadState({ kind: 'ready' });
  } catch (e) {
    setLoadState(mapError(e));
  }
};

function mapError(e: unknown): LoadState {
  if (e instanceof ApiError) {
    if (e.status === 401) return { kind: 'error', type: 'auth', message: '需要 API Key' };
    if (e.status === 403) return { kind: 'error', type: 'forbidden', message: '需要管理員權限' };
    return { kind: 'error', type: 'server', message: e.message };
  }
  return { kind: 'error', type: 'server', message: '網路錯誤，請稍後重試' };
}
```

### 三狀態 UI

| 狀態 | UI |
|------|-----|
| `auth` | 整頁換成 `<ApiKeyRequired />`（跟 settings/tools/alerts 行為一致） |
| `forbidden` | inline 區塊：「需要管理員權限」+ 連結到 settings |
| `server` | inline 區塊：錯誤訊息 + 「重試」按鈕（呼叫 `load()`） |

### handleDryRun / handleConfirmRun 失敗

仍用 toast 即可（這些是 mutation 失敗的 feedback，不是頁面狀態）。但要 catch 並把 `e` 過 `mapError` 邏輯，確保 401/403 也走正確顯示路徑。

### 為什麼 auth 用整頁 swap 而非 inline

`ApiKeyRequired` 元件已是專案標準（17 個工作流頁面都用），跟其他頁面行為一致比「多一種 inline 模式」重要。Inline 403 是必要的，因為這頁的「需要管理員權限」需要去 settings 換 admin key，inline 比全頁 swap 更順暢。

---

## Phase 21.4 — MyApiKeyPanel Rotate Modal 硬化

### 現況

`frontend/src/components/settings/MyApiKeyPanel.tsx:134-176`：
- 「Cancel」按鈕（line 161）可一鍵關閉
- 「Activate new key」（line 167）需勾「I have saved this key」checkbox 才能 enable
- 但 Cancel 跳過所有確認就關閉，**明文 key 永久遺失**

### 修改

1. 移除獨立「Cancel」按鈕
2. 主要關閉按鈕（原本的「Activate new key」）改名為「I've saved — close」，需 `confirmed === true` 才能 enable
3. backdrop click 與 ESC 鍵在 `confirmed === false` 時**完全 no-op**（不解鎖、不警告；使用者唯一關閉路徑是勾 checkbox 後按按鈕）
4. 為什麼 hard block 而非 soft block：spec 原文「禁止直接 cancel」直譯即 close 路徑全部封死；soft block（第一次警告第二次放行）會留下「我先看一下再關」的灰色路徑，違反禁止語意

```tsx
// 沒有 attemptedClose state；backdrop/ESC 直接忽略
const handleBackdropClick = (e: React.MouseEvent) => {
  if (e.target !== e.currentTarget) return; // 只處理 backdrop 本身
  if (!confirmed) return; // hard block
  setNewPlaintext(null);
  setConfirmed(false);
};

useEffect(() => {
  if (!newPlaintext) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !confirmed) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  document.addEventListener('keydown', handler, true); // capture phase
  return () => document.removeEventListener('keydown', handler, true);
}, [newPlaintext, confirmed]);
```

---

## Phase 21.5 — UserKeyTable Rotate Modal 硬化

### 現況

`frontend/src/components/admin/UserKeyTable.tsx:120-147`：
- 只有「Done」按鈕（line 142），無 Cancel
- 但也無「已交付給使用者」確認：admin 點 Done 直接關閉，若 admin 還沒把 key 給 user 就誤按，key 永久遺失

### 修改

加 `confirmed` state 與 checkbox：「I have delivered this key to the user」；「Done」按鈕需 confirmed 才 enable。backdrop click 與 ESC 同樣擋下。

```tsx
{plaintextFor && (
  <div
    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    onClick={(e) => { if (e.target === e.currentTarget) handleBackdropClick(); }}
    onKeyDown={(e) => { if (e.key === 'Escape') handleBackdropClick(); }}
  >
    <div className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4" role="dialog" aria-modal="true">
      <h4 className="font-bold text-lg">New key generated</h4>
      <p className="text-sm text-muted-foreground">
        Copy this key and deliver it to the user. It will not be shown again.
      </p>
      {/* ... copy button ... */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I have delivered this key to the user
      </label>
      <div className="flex justify-end">
        <button
          onClick={() => setPlaintextFor(null)}
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

---

## Phase 21.6 — Playwright E2E

新增兩個 spec：

### `frontend/e2e/admin-keys.spec.ts`

```
test('PageHero shows key statistics', async ({ page }) => {
  // 1. 登入 admin
  // 2. 訪問 /admin/keys
  // 3. 確認 PageHero command 顯示 "{n} active · {n} revoked · {n} no-key"
});

test('rotate modal cannot close without confirmation', async ({ page }) => {
  // 1. 訪問 /admin/keys
  // 2. 點某 user 的 Rotate 按鈕
  // 3. modal 出現，確認 Done 按鈕 disabled
  // 4. 點 backdrop：modal 仍開啟，顯示警告
  // 5. 勾選 checkbox
  // 6. 確認 Done 按鈕 enabled，點擊後 modal 關閉
});
```

### `frontend/e2e/admin-retention.spec.ts`

```
test('PageHero shows last run timestamp', async ({ page }) => {
  // 1. 訪問 /admin/retention
  // 2. 確認 PageHero command 顯示 "never" 或 timestamp
});

test('403 state shows forbidden message', async ({ page, context }) => {
  // 1. 用非 admin API key 設定 localStorage
  // 2. 訪問 /admin/retention
  // 3. 確認 inline 區塊顯示「需要管理員權限」
});

test('500 state shows retry button', async ({ page }) => {
  // 1. mock adminRetention.status() 回 500
  // 2. 訪問 /admin/retention
  // 3. 確認 inline 區塊顯示錯誤訊息 + Retry 按鈕
  // 4. 解除 mock，點 Retry → status 載入成功
});
```

---

## Error Handling

| 場景 | 行為 |
|------|------|
| `RetentionPanel` 載入 401 | 整頁換 `<ApiKeyRequired />` |
| `RetentionPanel` 載入 403 | inline 區塊「需要管理員權限」+ 連結 |
| `RetentionPanel` 載入 500/network | inline 區塊 + Retry 按鈕 |
| `RetentionPanel` dry-run/run mutation 失敗 | toast 顯示錯誤訊息（與 mutation context 一致） |
| Modal backdrop click / ESC | 在 `confirmed === false` 時完全 no-op；唯一關閉路徑是勾選 checkbox 後點擊「I've saved — close」按鈕 |
| PageHero 載入失敗 | 顯示 'loading...' fallback（不擋頁面渲染） |

---

## Testing

### Backend

- 修改 `backend/tests/utils/retention.test.ts` 使用 unique marker
- 確認 `npm test` 與 `npx vitest run` 都 54/54 PASS
- 確認平行（不指定 `--fileParallelism`）下 retention.test.ts 連跑 5 次都穩定

### Frontend

- `frontend/src/components/admin/RetentionPanel.test.tsx`（新增或更新）：
  - mock api.adminRetention.status() 拋 401 → 渲染 `<ApiKeyRequired />`
  - mock 403 → 渲染 forbidden 區塊
  - mock 500 + 點 Retry → 重新呼叫 status() → 成功渲染 counts
- `frontend/src/components/settings/MyApiKeyPanel.test.tsx`（新增）：
  - rotate 後 modal 開啟 → Done 按鈕 disabled
  - 點 backdrop 不關閉 modal
  - 勾選 checkbox 後 Done enabled
- `frontend/src/components/admin/UserKeyTable.test.tsx`（新增）：
  - 同 MyApiKeyPanel，但 checkbox label 為「I have delivered this key to the user」

### E2E

- `frontend/e2e/admin-keys.spec.ts`（新增）
- `frontend/e2e/admin-retention.spec.ts`（新增）

---

## Files Changed

### P0

- `backend/tests/utils/retention.test.ts`（改：unique marker）

### Phase 21

- `frontend/src/app/admin/keys/page.tsx`（改：使用 PageHero）
- `frontend/src/app/admin/retention/page.tsx`（改：使用 PageHero）
- `frontend/src/components/admin/RetentionPanel.tsx`（改：三狀態錯誤處理）
- `frontend/src/components/settings/MyApiKeyPanel.tsx`（改：移除 Cancel、硬化關閉）
- `frontend/src/components/admin/UserKeyTable.tsx`（改：加 checkbox、硬化關閉）
- `frontend/src/components/admin/RetentionPanel.test.tsx`（新增）
- `frontend/src/components/settings/MyApiKeyPanel.test.tsx`（新增）
- `frontend/src/components/admin/UserKeyTable.test.tsx`（新增）
- `frontend/e2e/admin-keys.spec.ts`（新增）
- `frontend/e2e/admin-retention.spec.ts`（新增）
- `specs/ACCEPTANCE.md`（更新：補 P0 證據 + Phase 21 章節）
- `specs/TODO.md`（更新：Phase 21 標記完成、補 Phase 21.6 細項）

---

## Acceptance Criteria

### P0

- [ ] `cd backend && npm test` 54/54 PASS（不指定 `--fileParallelism`）
- [ ] `cd backend && npx vitest run` 54/54 PASS（不指定 `--fileParallelism`）
- [ ] `retention.test.ts` 連跑 5 次都穩定
- [ ] `specs/ACCEPTANCE.md` 的「54/54 PASS」證據改用預設 `npm test` 輸出

### Phase 21

- [ ] `/admin/keys` 與 `/admin/retention` 都用 `<PageHero>`，高度/樣式與 settings 視覺一致
- [ ] `/admin/keys` PageHero command 顯示「{n} active · {n} revoked · {n} no-key」
- [ ] `/admin/retention` PageHero command 顯示 `lastRunAt` timestamp 或「never」
- [ ] `RetentionPanel` 401 狀態渲染 `<ApiKeyRequired />`
- [ ] `RetentionPanel` 403 狀態渲染 forbidden inline 區塊
- [ ] `RetentionPanel` 500 狀態渲染錯誤區塊 + Retry 按鈕（點擊後重試成功）
- [ ] `MyApiKeyPanel` rotate modal：移除 Cancel 按鈕
- [ ] `MyApiKeyPanel` rotate modal：backdrop click / ESC 在未勾 checkbox 時擋下
- [ ] `MyApiKeyPanel` rotate modal：勾選後 Done 按鈕 enable
- [ ] `UserKeyTable` rotate modal：加「I have delivered this key to the user」checkbox
- [ ] `UserKeyTable` rotate modal：未勾時 Done disabled
- [ ] `RetentionPanel.test.tsx`、`MyApiKeyPanel.test.tsx`、`UserKeyTable.test.tsx` 全部通過
- [ ] `e2e/admin-keys.spec.ts` 與 `e2e/admin-retention.spec.ts` 全部通過
- [ ] 既有 smoke 測試仍通過，無 regression
- [ ] `npm run lint` 0 error
- [ ] `npm run build` 通過（frontend + backend）
