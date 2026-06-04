# Auth 修復驗收 + 狀態一致化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收斂所有頁面的 401 行為，避免 UI 卡住、promise rejection 和 console spam，使 auth 錯誤處理一致且可驗收。

**Architecture:** 改進 `pollSession` 加入 `onAuthError` 回調，統一所有 polling 消費者的 401 通知機制。補齊遺漏的 catch error handling（SOCAnalysisWorkspace refresh-data、report download）。將 BGP 頁面的 raw fetch 收進 `api.ts` 的 `api.bgp.*` 方法。

**Tech Stack:** TypeScript, React, Next.js, Zustand (store), Lucide icons

---

## File Structure

| File | Role |
|------|------|
| `src/lib/api.ts` | 修改 `pollSession` 簽名 + 新增 `api.bgp.lookup` / `api.bgp.whois` / `api.bgp.prefixes` 方法 |
| `src/components/soc/SOCAnalysisWorkspace.tsx` | 補 `.catch()` on refresh-data、`onAuthError` callback、`handleDownloadPDF` 加 auth |
| `src/app/threat/investigate/page.tsx` | `pollSession` 接 `onAuthError`、`api.ip.check` 401 處理 |
| `src/app/pentest/assist/page.tsx` | `pollSession` 接 `onAuthError`、report download 401 處理 |
| `src/app/pentest/demo/page.tsx` | `pollSession` 接 `onAuthError` |
| `src/app/threat/bgp/page.tsx` | 用 `api.bgp.whois` / `api.bgp.prefixes` 替換 raw fetch |

---

### Task 1: 改進 `pollSession` — 加入 `onAuthError` 回調

**Files:**
- Modify: `src/lib/api.ts:809-850`

- [ ] **Step 1: 修改 `pollSession` 簽名和實現**

在 `src/lib/api.ts` 中找到 `pollSession` 函數（第 809 行），將其改為：

```typescript
export function pollSession(
  sessionId: string,
  module: 'soc' | 'threat' | 'pentest',
  onUpdate: (session: SessionDetail) => void,
  options?: { interval?: number; onAuthError?: () => void }
): () => void {
  const interval = options?.interval ?? 2000;
  const onAuthError = options?.onAuthError;
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      let response: { session: SessionDetail };
      if (module === 'soc') response = await api.soc.getSession(sessionId);
      else if (module === 'threat') response = await api.threat.getSession(sessionId);
      else response = await api.pentest.getSession(sessionId);

      onUpdate(response.session);

      if (response.session.status === 'completed') {
        stopped = true;
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        stopped = true;
        onAuthError?.();
        return;
      }
      console.error('Polling error:', error);
    }
  };

  const intervalId = setInterval(poll, interval);
  poll();

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
```

- [ ] **Step 2: 驗證所有現有調用者不受破壞**

執行 TypeScript 檢查，確認現有調用者（使用 `interval` 作為第四個參數的）不會報錯：

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

現有調用者都只傳 3 個參數（sessionId, module, onUpdate），第四個 options 是 optional，所以不會報錯。確認無錯誤。

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/lib/api.ts && git commit -m "refactor(api): add onAuthError callback to pollSession"
```

---

### Task 2: 新增 `api.bgp.lookup`、`api.bgp.whois` 和 `api.bgp.prefixes` 方法

**Files:**
- Modify: `src/lib/api.ts:419-438`

**注意：** 後端有兩個不同的 BGP 查詢端點：
- `/api/bgp/query` — 查詢 BGP 更新記錄（已存在 `api.bgp.query()`）
- `/api/bgp/lookup` — 查詢任意 IP/前綴的 BGP 資訊（RIPEstat），BGP 頁面使用此端點

- [ ] **Step 1: 在 `api.bgp` 區塊中新增 lookup、whois 和 prefixes 方法**

找到 `src/lib/api.ts` 中 `bgp:` 區塊（第 419 行），在 `stats()` 方法之後、`},` 之前新增：

```typescript
    async lookup(resource: string): Promise<{ resource: string; type: string; announced: boolean; asns: { asn: number; holder: string; country?: string }[]; block: { resource: string; desc: string } | null }> {
      const query = new URLSearchParams({ resource });
      return request(`/api/bgp/lookup?${query}`, { requireAuth: true });
    },
    async whois(asn: string): Promise<{ asn: string; holder: string; country: string; block: string }> {
      return request(`/api/bgp/whois/${encodeURIComponent(asn)}`, { requireAuth: true });
    },
    async prefixes(asn: string): Promise<{ prefixes: Array<{ prefix: string; type: 'ipv4' | 'ipv6' }> }> {
      return request(`/api/bgp/prefixes/${encodeURIComponent(asn)}`, { requireAuth: true });
    },
```

- [ ] **Step 2: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

確認無錯誤。

- [ ] **Step 3: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/lib/api.ts && git commit -m "feat(api): add bgp.whois and bgp.prefixes methods"
```

---

### Task 3: BGP 頁面 — 用 `api.bgp.*` 替換 raw fetch

**Files:**
- Modify: `src/app/threat/bgp/page.tsx:6,99,111-142,151-178`

- [ ] **Step 1: 移除不再需要的 imports**

在 `src/app/threat/bgp/page.tsx` 中，移除第 6 行的 `getApiKey` import（保留 `ApiError`）：

```typescript
// Before:
import { getApiKey, ApiError } from '@/lib/api';
// After:
import { api, ApiError } from '@/lib/api';
```

- [ ] **Step 2: 重寫 `handleSearch` 使用 `api.bgp.*`**

找到 `handleSearch` 函數（第 102 行），將其完整替換為：

```typescript
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResult(null);
    setError(null);

    try {
      const [statsData, lookupData] = await Promise.all([
        api.bgp.stats(),
        api.bgp.lookup(query),
      ]);
      setStats(statsData);
      setResult(lookupData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        return;
      }
      console.error('Failed to search:', err);
      setError('查詢失敗');
    } finally {
      setLoading(false);
    }
  }, [query, queryType]);
```

注意：`api.bgp.query` 返回 `BgpQueryResult`，其結構包含 `{ resource, type, announced, asns, block }`，與頁面的 `LookupResult` 介面一致。

- [ ] **Step 3: 重寫 `handleAsnClick` 使用 `api.bgp.whois` / `api.bgp.prefixes`**

找到 `handleAsnClick` 函數（第 151 行），將其完整替換為：

```typescript
  const handleAsnClick = async (asn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAsn(asn);
    setWhoIsLoading(true);
    setPrefixesLoading(true);
    setWhoIsData(null);
    setPrefixes([]);
    try {
      const [whoisData, prefixesData] = await Promise.all([
        api.bgp.whois(asn),
        api.bgp.prefixes(asn),
      ]);
      setWhoIsData(whoisData);
      setPrefixes(prefixesData.prefixes || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        return;
      }
      console.error('Failed to fetch ASN data:', err);
    } finally {
      setWhoIsLoading(false);
      setPrefixesLoading(false);
    }
  };
```

- [ ] **Step 4: 移除不再使用的 `getApiKey` 相關代碼**

確認第 99 行的 `authError` state 和 JSX 中的 `<ApiKeyRequired />` 仍保留不變。

- [ ] **Step 5: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

確認無錯誤。

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/app/threat/bgp/page.tsx && git commit -m "refactor(bgp): replace raw fetch with api.bgp.whois/prefixes methods"
```

---

### Task 4: SOCAnalysisWorkspace — 補齊 refresh-data `.catch()` + `onAuthError`

**Files:**
- Modify: `src/components/soc/SOCAnalysisWorkspace.tsx:160-170,345-350,402-407`

- [ ] **Step 1: 為 refresh-data 加上 `.catch()`**

找到 `case 'refresh-data':`（第 402 行），將其替換為：

```typescript
      case 'refresh-data':
        if (currentSessionId) {
          api.soc.getSession(currentSessionId).then((res) => {
            syncSessionToStore(res.session);
          }).catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              setAuthError(true);
            } else {
              console.error('Refresh data failed:', err);
            }
          });
        }
        break;
```

- [ ] **Step 2: 為兩處 `pollSession` 調用加上 `onAuthError`**

找到第一處 `pollSession` 調用（在 `loadSession` 的 `useEffect` 中，約第 160 行）：

```typescript
// Before:
          pollCleanupRef.current = pollSession(
            session.id,
            'soc',
            (updatedSession) => {
```

改為：

```typescript
          pollCleanupRef.current = pollSession(
            session.id,
            'soc',
            (updatedSession) => {
              // ... existing onUpdate body unchanged ...
            },
            { onAuthError: () => setAuthError(true) }
          );
```

找到第二處 `pollSession` 調用（在 `handleAlertSubmit` 中，約第 345 行）：

```typescript
// Before:
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'soc',
        (session) => {
          syncSessionToStore(session);
        }
      );
```

改為：

```typescript
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'soc',
        (session) => {
          syncSessionToStore(session);
        },
        { onAuthError: () => setAuthError(true) }
      );
```

- [ ] **Step 3: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/components/soc/SOCAnalysisWorkspace.tsx && git commit -m "fix(soc): add .catch() to refresh-data and onAuthError to pollSession calls"
```

---

### Task 5: threat/investigate — polling `onAuthError` + `api.ip.check` 401

**Files:**
- Modify: `src/app/threat/investigate/page.tsx:86-99,112-121`

- [ ] **Step 1: 為 `api.ip.check` 的 catch 加上 401 處理**

找到 `api.ip.check` 的 catch 塊（第 91 行），將其替換為：

```typescript
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthError(true);
          setLoading(false);
          return;
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('API使用上限') || errorMessage.includes('429')) {
          setError('API 使用上限，請聯絡管理員');
        } else {
          console.error('IP reputation check failed:', err);
        }
      } finally {
```

- [ ] **Step 2: 為 `pollSession` 調用加上 `onAuthError`**

找到 `pollSession` 調用（第 112 行），將其替換為：

```typescript
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'threat',
        (updatedSession) => {
          setSession(updatedSession);
          if (updatedSession.status === 'completed') {
            setLoading(false);
          }
        },
        { onAuthError: () => { setAuthError(true); setLoading(false); } }
      );
```

- [ ] **Step 3: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/app/threat/investigate/page.tsx && git commit -m "fix(threat): add 401 handling to ip.check and onAuthError to pollSession"
```

---

### Task 6: pentest/assist — polling `onAuthError` + report download 401

**Files:**
- Modify: `src/app/pentest/assist/page.tsx:244-267,349-361,536-570`

- [ ] **Step 1: 為 `loadSessionFromUrl` 的 `pollSession` 加上 `onAuthError`**

找到 `loadSessionFromUrl` 中的 `pollSession` 調用（第 244 行），將其替換為：

```typescript
          pollCleanupRef.current = pollSession(
            sessionId,
            'pentest',
            (updatedSession) => {
              setSession(updatedSession);
              setSteps(convertApiStepsToStoreSteps(updatedSession.steps));

              const latestStep = updatedSession.steps?.[updatedSession.steps.length - 1];
              if (latestStep && isToolExecutingStep(latestStep.content ?? null)) {
                setCurrentTool(extractToolName(latestStep.content ?? null));
                setIsToolExecuting(true);
              } else if (updatedSession.status === 'completed') {
                setIsToolExecuting(false);
                setCurrentTool(null);
              }

              if (updatedSession.status === 'completed') {
                setLoading(false);
                stopExecution();
                setReport(generateReportFromSession(updatedSession));
              }
            },
            { onAuthError: () => { setAuthError(true); setLoading(false); stopExecution(); } }
          );
```

- [ ] **Step 2: 為 `handleStart` 的 `pollSession` 加上 `onAuthError`**

找到 `handleStart` 中的 `pollSession` 調用（第 349 行），將其替換為：

```typescript
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'pentest',
        (updatedSession) => {
          setSession(updatedSession);
          if (updatedSession.status === 'completed') {
            setLoading(false);
            stopExecution();
            setReport(generateReportFromSession(updatedSession));
          }
        },
        { onAuthError: () => { setAuthError(true); setLoading(false); stopExecution(); } }
      );
```

- [ ] **Step 3: 為 PDF download 加上 401 處理**

找到 PDF download 的 onClick handler（第 536 行），將其 catch 塊替換為：

```typescript
                    onClick={async () => {
                      try {
                        const blob = await api.pentest.downloadReport(session.id);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Pentest-Report-${session.id}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        if (err instanceof ApiError && err.status === 401) {
                          setAuthError(true);
                          return;
                        }
                        setError(err instanceof Error ? err.message : '下載報告失敗');
                      }
                    }}
```

- [ ] **Step 4: 為 JSON export 加上 401 處理**

找到 JSON export 的 onClick handler（第 557 行），將其 catch 塊替換為：

```typescript
                    onClick={async () => {
                      try {
                        const data = await api.pentest.getReportData(session.id);
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Pentest-Report-${session.id}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        if (err instanceof ApiError && err.status === 401) {
                          setAuthError(true);
                          return;
                        }
                        setError(err instanceof Error ? err.message : '下載報告失敗');
                      }
                    }}
```

- [ ] **Step 5: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/app/pentest/assist/page.tsx && git commit -m "fix(pentest): add onAuthError to pollSession and 401 handling to report downloads"
```

---

### Task 7: pentest/demo — polling `onAuthError`

**Files:**
- Modify: `src/app/pentest/demo/page.tsx:334,398`

- [ ] **Step 1: 為 `loadSessionFromUrl` 的 `pollSession` 加上 `onAuthError`**

找到 `loadSessionFromUrl` 中的 `pollSession` 調用（約第 334 行），將其第四個參數改為：

```typescript
          pollCleanupRef.current = pollSession(
            sessionId,
            'pentest',
            (updatedSession) => {
              setSession(updatedSession);
              if (updatedSession.status === 'completed') {
                setLoading(false);
                stopExecution();
                setReport(generateReportFromSession(updatedSession));
              }
            },
            { onAuthError: () => { setAuthError(true); setLoading(false); stopExecution(); } }
          );
```

- [ ] **Step 2: 為 `handleStart` 的 `pollSession` 加上 `onAuthError`**

找到 `handleStart` 中的 `pollSession` 調用（約第 398 行），將其第四個參數改為：

```typescript
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'pentest',
        (updatedSession) => {
          setSession(updatedSession);
          if (updatedSession.status === 'completed') {
            setLoading(false);
            stopExecution();
            setReport(generateReportFromSession(updatedSession));
          }
        },
        { onAuthError: () => { setAuthError(true); setLoading(false); stopExecution(); } }
      );
```

- [ ] **Step 3: TypeScript 檢查**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npx tsc --noEmit --pretty false 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add src/app/pentest/demo/page.tsx && git commit -m "fix(pentest-demo): add onAuthError to pollSession calls"
```

---

### Task 8: Lint + Build 驗證

- [ ] **Step 1: 執行 lint**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint 2>&1 | tail -20
```

預期：無 error（warning 可接受）。

- [ ] **Step 2: 執行 build**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run build 2>&1 | tail -30
```

預期：Build 成功，無 error。

- [ ] **Step 3: 靜態搜尋驗證**

搜尋所有 raw `fetch('/api` 調用，確認只剩下必要的（如 `handleDownloadPDF` 的 `window.open`）：

```bash
cd /Users/user/Code/SecurityWeb/frontend && grep -rn "fetch('/api" src/ --include="*.tsx" --include="*.ts"
```

預期：無結果（BGP 頁面的 raw fetch 已被替換）。

搜尋所有 `window.open('/api` 調用：

```bash
cd /Users/user/Code/SecurityWeb/frontend && grep -rn "window.open('/api" src/ --include="*.tsx" --include="*.ts"
```

預期：僅 `SOCAnalysisWorkspace.tsx` 的 `handleDownloadPDF`（此為已知的 browser-native download，保留不變）。

- [ ] **Step 4: Commit（如有 lint fix）**

```bash
cd /Users/user/Code/SecurityWeb/frontend && git add -A && git commit -m "chore: lint fixes for auth consistency changes" --allow-empty
```

---

### Task 9: 清理工作樹

- [ ] **Step 1: 檢查未追蹤文件**

```bash
cd /Users/user/Code/SecurityWeb && git status
```

確認 `.playwright-mcp/*` 和 `backend/prisma/dev.db` 不在 staged 區域中。

- [ ] **Step 2: 如果需要，加入 .gitignore**

檢查 `backend/.gitignore` 是否已忽略 `prisma/dev.db`：

```bash
grep -n "dev.db" /Users/user/Code/SecurityWeb/backend/.gitignore 2>/dev/null || echo "NOT FOUND"
```

如果未找到，在 `backend/.gitignore` 末尾加入：

```
prisma/dev.db
```

- [ ] **Step 3: 最終 git status 確認**

```bash
cd /Users/user/Code/SecurityWeb && git status
```

確認只有本輪修改的文件在 staged/unstaged 區域中。

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] `/pentest/assist` session load/start catch 401 時 setLoading(false) + stopExecution() → Task 6
   - [x] `/threat/investigate` api.ip.check + api.threat.investigate 401 → Task 5
   - [x] Report download / JSON export 401 → Task 6
   - [x] SOCAnalysisWorkspace refresh-data `.catch()` → Task 4
   - [x] `pollSession` onAuthError callback → Task 1
   - [x] 所有 polling 消費者接上 callback → Tasks 4, 5, 6, 7
   - [x] BGP raw fetch 收進 `api.ts`（lookup + whois + prefixes） → Tasks 2, 3
   - [x] 工作樹清理 → Task 9

2. **Placeholder scan:** 無 TBD/TODO/placeholder。

3. **Type consistency:**
   - `pollSession` 第四個參數從 `number` 改為 `{ interval?: number; onAuthError?: () => void }`。所有現有調用者只傳 3 個參數，不受影響。新調用者使用 `{ onAuthError: ... }` 格式。
   - `api.bgp.lookup(resource: string)` 返回 `{ resource, type, announced, asns, block }`，與 BGP 頁面的 `LookupResult` 介面一致。
   - `api.bgp.whois(asn: string)` 返回 `{ asn, holder, country, block }`，與 BGP 頁面的 `WhoIsResult` 介面一致。
   - `api.bgp.prefixes(asn: string)` 返回 `{ prefixes: [...] }`，與 BGP 頁面的 `PrefixInfo[]` 介面一致。
