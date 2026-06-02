# Phase 1: 可信 UI 與可用入口 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓使用者能實際使用工具和告警功能，建立 API key 管理入口，統一 401 錯誤提示，修復 pentest/assist 資料流，完成 alert → session 調查閉環。

**Architecture:** 在现有 Next.js App Router + Fastify 架構上，擴展 settings 頁面加入 API key 管理，建立共用的 401 錯誤提示元件，修復前端資料流問題。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Fastify, Prisma, PostgreSQL

---

## Task 1: 建立共用 API Key 錯誤提示元件

**Files:**
- Create: `frontend/src/components/ui/ApiKeyRequired.tsx`

**目標:** 建立一個共用元件，當 API 返回 401 時顯示統一的「請先設定 API Key」提示，並提供跳轉到設定頁的按鈕。

- [ ] **Step 1: 建立 ApiKeyRequired 元件**

```tsx
// frontend/src/components/ui/ApiKeyRequired.tsx
'use client';

import { AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ApiKeyRequiredProps {
  message?: string;
}

export function ApiKeyRequired({ message = '請先設定 API Key' }: ApiKeyRequiredProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="flex items-center gap-3 text-[var(--terminal-amber)]">
        <AlertTriangle className="h-8 w-8" />
        <span className="text-lg font-mono">{message}</span>
      </div>
      <Link href="/settings">
        <Button className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium">
          <Settings className="h-4 w-4 mr-2" />
          前往設定 API Key
        </Button>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/ApiKeyRequired.tsx
git commit -m "feat: add ApiKeyRequired component for unified 401 error display"
```

---

## Task 2: Settings 頁面新增 API Key 管理區

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`

**目標:** 在 settings 頁面新增 API key 管理區，讓使用者可以輸入、測試、保存、清除 API key。

- [ ] **Step 1: 讀取現有 settings 頁面**

確認現有結構：
- Line 1-18: imports 和 interface
- Line 19-56: state 和 useEffect
- Line 118-278: JSX render

- [ ] **Step 2: 新增 API Key state 和 functions**

在 state 區域（約 line 33 後）新增：
```tsx
const [apiKey, setApiKey] = useState('');
const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
const [testingApiKey, setTestingApiKey] = useState(false);
```

在 useEffect 後新增 API key 相關函數：
```tsx
// API Key management
useEffect(() => {
  const storedKey = api.getApiKey();
  if (storedKey) {
    setApiKey(storedKey);
    setApiKeyStatus('valid');
  }
}, []);

const handleTestApiKey = async () => {
  try {
    setTestingApiKey(true);
    // 使用 health endpoint 測試 API key
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/health`, {
      headers: { 'X-API-Key': apiKey },
    });
    if (response.ok) {
      setApiKeyStatus('valid');
    } else {
      setApiKeyStatus('invalid');
    }
  } catch {
    setApiKeyStatus('invalid');
  } finally {
    setTestingApiKey(false);
  }
};

const handleSaveApiKey = () => {
  if (apiKey.trim()) {
    api.setApiKey(apiKey.trim());
    setApiKeyStatus('valid');
  }
};

const handleClearApiKey = () => {
  api.clearApiKey();
  setApiKey('');
  setApiKeyStatus('idle');
};
```

- [ ] **Step 3: 在 JSX 中新增 API Key 管理區**

在 provider selection 區塊前（約 line 129 後）新增：
```tsx
{/* API Key Management */}
<div className="space-y-4">
  <label className="block text-sm font-medium text-[var(--foreground)]">
    <span className="font-mono text-[var(--terminal-green)]">$</span> api-key-management
  </label>
  <div className="flex gap-2">
    <input
      type="password"
      value={apiKey}
      onChange={(e) => {
        setApiKey(e.target.value);
        setApiKeyStatus('idle');
      }}
      placeholder="輸入你的 API Key"
      className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:border-[var(--terminal-green)]/50 transition-all duration-300"
    />
    <Button
      variant="outline"
      onClick={handleTestApiKey}
      disabled={testingApiKey || !apiKey.trim()}
      className="border-[var(--border)] text-[var(--foreground)] hover:border-[var(--terminal-green)]/50"
    >
      {testingApiKey ? '測試中...' : '測試'}
    </Button>
    <Button
      onClick={handleSaveApiKey}
      disabled={!apiKey.trim()}
      className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium"
    >
      儲存
    </Button>
    <Button
      variant="outline"
      onClick={handleClearApiKey}
      disabled={!apiKey}
      className="border-[var(--border)] text-[var(--foreground)] hover:border-red-500/50 hover:text-red-500"
    >
      清除
    </Button>
  </div>
  {apiKeyStatus === 'valid' && (
    <div className="flex items-center gap-2 text-sm text-[var(--terminal-green)] font-mono">
      <CheckCircle className="h-4 w-4" />
      API Key 已設定且有效
    </div>
  )}
  {apiKeyStatus === 'invalid' && (
    <div className="flex items-center gap-2 text-sm text-[var(--terminal-amber)] font-mono">
      <XCircle className="h-4 w-4" />
      API Key 無效或無法連線
    </div>
  )}
</div>

{/* Divider */}
<div className="border-t border-[var(--border)]" />
```

- [ ] **Step 4: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/settings/page.tsx
git commit -m "feat: add API key management section to settings page"
```

---

## Task 3: Tools 頁面加入 401 錯誤處理

**Files:**
- Modify: `frontend/src/app/tools/page.tsx`

**目標:** 當 API 返回 401 時，顯示 ApiKeyRequired 元件。

- [ ] **Step 1: 讀取 tools 頁面結構**

找到 state 定義和資料載入邏輯。

- [ ] **Step 2: 新增 401 狀態處理**

在 state 區域新增：
```tsx
const [authError, setAuthError] = useState(false);
```

在資料載入的 catch 區塊中，檢查 401 錯誤：
```tsx
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    setAuthError(true);
  } else {
    // 原有的錯誤處理
  }
}
```

在 JSX 開頭加入條件渲染：
```tsx
if (authError) {
  return <ApiKeyRequired />;
}
```

- [ ] **Step 3: 加入 import**

```tsx
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
```

- [ ] **Step 4: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/tools/page.tsx
git commit -m "feat: add 401 error handling with ApiKeyRequired to tools page"
```

---

## Task 4: Alerts 頁面加入 401 錯誤處理

**Files:**
- Modify: `frontend/src/app/alerts/page.tsx`

**目標:** 當 API 返回 401 時，顯示 ApiKeyRequired 元件。

- [ ] **Step 1: 讀取 alerts 頁面結構**

找到 state 定義和資料載入邏輯。

- [ ] **Step 2: 新增 401 狀態處理**

在 state 區域新增：
```tsx
const [authError, setAuthError] = useState(false);
```

在 loadAlerts 函數的 catch 區塊中，檢查 401 錯誤：
```tsx
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    setAuthError(true);
  } else {
    // 原有的錯誤處理
  }
}
```

在 JSX 開頭加入條件渲染：
```tsx
if (authError) {
  return <ApiKeyRequired />;
}
```

- [ ] **Step 3: 加入 import**

```tsx
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
```

- [ ] **Step 4: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/alerts/page.tsx
git commit -m "feat: add 401 error handling with ApiKeyRequired to alerts page"
```

---

## Task 5: Dashboard 頁面加入 401 錯誤處理

**Files:**
- Modify: `frontend/src/app/page.tsx`

**目標:** 當 API 返回 401 時，顯示 ApiKeyRequired 元件。

- [ ] **Step 1: 讀取 dashboard 頁面結構**

找到 state 定義和資料載入邏輯。

- [ ] **Step 2: 新增 401 狀態處理**

在 state 區域新增：
```tsx
const [authError, setAuthError] = useState(false);
```

在資料載入的 catch 區塊中，檢查 401 錯誤：
```tsx
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    setAuthError(true);
  } else {
    // 原有的錯誤處理
  }
}
```

在 JSX 開頭加入條件渲染：
```tsx
if (authError) {
  return <ApiKeyRequired />;
}
```

- [ ] **Step 3: 加入 import**

```tsx
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
```

- [ ] **Step 4: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: add 401 error handling with ApiKeyRequired to dashboard page"
```

---

## Task 6: Pentest Assist 接回 TargetInputPanel

**Files:**
- Modify: `frontend/src/app/pentest/assist/page.tsx`

**目標:** 修復 inputConfig 只寫不讀的問題，讓 TargetInputPanel 正確接收和使用 inputConfig。

- [ ] **Step 1: 讀取 pentest/assist 頁面**

確認 TargetInputPanel 的使用方式和 inputConfig 的定義。

- [ ] **Step 2: 修正 TargetInputPanel 的 props 傳遞**

確保 TargetInputPanel 正確接收 demoInput 並填充表單：
```tsx
<TargetInputPanel
  selectedTemplate={selectedTemplate}
  onStart={handleStart}
  isExecuting={isExecuting}
  onLoadDemo={handleLoadDemo}
  demoInput={demoInput}
/>
```

- [ ] **Step 3: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/pentest/assist/page.tsx
git commit -m "fix: connect inputConfig to TargetInputPanel in pentest assist"
```

---

## Task 7: Alerts 頁面「開始調查」導向真實 Session

**Files:**
- Modify: `frontend/src/app/alerts/page.tsx`

**目標:** 當使用者點擊「開始調查」後，導向真實的 session 頁面，形成 alert → session 閉環。

- [ ] **Step 1: 找到「開始調查」按鈕和處理函數**

在 alerts 頁面中找到 investigate 相關的處理邏輯。

- [ ] **Step 2: 修改 investigate 處理函數**

確保 investigate 成功後導向正確的 session 頁面：
```tsx
const handleInvestigate = async (alertId: string) => {
  try {
    const result = await api.alerts.investigate(alertId, { type: 'threat' });
    // 導向調查工作台
    window.location.href = `/investigations/${result.session_id}`;
  } catch (err) {
    // 錯誤處理
  }
};
```

- [ ] **Step 3: 驗證修改**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/alerts/page.tsx
git commit -m "feat: redirect to investigation session after starting investigation from alerts"
```

---

## Verification Checklist

完成所有 Task 後：

- [ ] `frontend/npm run lint` 無錯誤
- [ ] `frontend/npm run build` 成功
- [ ] Settings 頁面顯示 API key 管理區
- [ ] 未設定 API key 時 tools/alerts/dashboard 顯示統一提示
- [ ] 設定 API key 後可正常存取資料
- [ ] Pentest assist 的 TargetInputPanel 正確接收 demoInput
- [ ] Alerts 頁面「開始調查」導向真實 session 頁面

---

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | 後端 API URL |
| `BACKEND_URL` | `http://localhost:4000` | Next.js rewrite 用 |
