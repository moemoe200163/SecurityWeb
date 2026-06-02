# Phase 2: 深度調查工作台 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立統一的深度調查工作台，修復 broken route，讓 alerts 頁面的「開始調查」能正確導向並顯示調查 session。

**Architecture:** 建立 `/investigations/[sessionId]` 動態路由，複用現有 `SOCAnalysisWorkspace` 組件，支援從 alerts 和 dashboard 進入調查。

**Tech Stack:** Next.js 16 App Router, React 19, Zustand, Fastify, Prisma

---

## 現狀分析

| 問題 | 說明 |
|------|------|
| Broken route | alerts 頁面導向 `/investigations/:sessionId`，但路由不存在 |
| 兩種 UI 模式 | SOC 用 `SOCAnalysisWorkspace`，Threat 有自己的 inline 實作 |
| 未使用組件 | `StepProgress`、`StepCard`、`AnalysisReport` 存在但未使用 |
| Alert-Session 連結 | `Alert.sessionId` 是 soft link（String?），不是 Prisma relation |

---

## Task 1: 建立 `/investigations/[sessionId]` 動態路由

**Files:**
- Create: `frontend/src/app/investigations/[sessionId]/page.tsx`

**目標:** 建立動態路由，支援從 alerts 導向的 `/investigations/:sessionId` URL。

- [ ] **Step 1: 建立路由頁面**

```tsx
// frontend/src/app/investigations/[sessionId]/page.tsx
'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { SOCAnalysisWorkspace } from '@/components/soc/SOCAnalysisWorkspace';

export default function InvestigationPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  return (
    <Suspense fallback={<div className="p-8 text-center">載入調查工作台...</div>}>
      <SOCAnalysisWorkspace initialSessionId={sessionId} />
    </Suspense>
  );
}
```

- [ ] **Step 2: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/investigations/
git commit -m "feat: add /investigations/[sessionId] dynamic route"
```

---

## Task 2: 修改 SOCAnalysisWorkspace 支援 alert session 載入

**Files:**
- Modify: `frontend/src/components/soc/SOCAnalysisWorkspace.tsx`

**目標:** 當 `initialSessionId` 來自 alert investigation 時，正確載入 session 數據並顯示。

- [ ] **Step 1: 讀取 SOCAnalysisWorkspace 找到 session 載入邏輯**

找到 useEffect 中處理 `initialSessionId` 的部分。

- [ ] **Step 2: 修改 session 載入邏輯**

確保當 session 載入時，如果 input 包含 `alertId`，能正確顯示告警摘要：

```tsx
// 在載入 session 後，檢查是否有 alert 資料
useEffect(() => {
  if (session) {
    const input = session.input as Record<string, unknown>;
    if (input.alertId) {
      // 設置 alert 資料
      setAlertData({
        id: input.alertId as string,
        title: input.alertTitle as string,
        severity: input.alertSeverity as string,
        rawContent: input.rawContent as string,
        aiVerdict: input.aiVerdict as string,
      });
    }
  }
}, [session]);
```

- [ ] **Step 3: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/soc/SOCAnalysisWorkspace.tsx
git commit -m "feat: support alert session loading in SOCAnalysisWorkspace"
```

---

## Task 3: 建立 AlertSessionInfo 組件顯示告警摘要

**Files:**
- Create: `frontend/src/components/soc/AlertSessionInfo.tsx`

**目標:** 在調查工作台中顯示關聯告警的摘要資訊。

- [ ] **Step 1: 建立 AlertSessionInfo 組件**

```tsx
// frontend/src/components/soc/AlertSessionInfo.tsx
'use client';

import React from 'react';
import { AlertTriangle, Shield, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertSessionInfoProps {
  alertId: string;
  title: string;
  severity: string;
  aiVerdict?: string | null;
  className?: string;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  info: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

export function AlertSessionInfo({
  alertId,
  title,
  severity,
  aiVerdict,
  className
}: AlertSessionInfoProps) {
  return (
    <div className={cn('rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-mono text-[var(--muted-foreground)]">
        <AlertTriangle className="h-4 w-4" />
        <span>關聯告警</span>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-[var(--foreground)]">{title}</h4>

        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-mono border',
            severityColors[severity] || severityColors.info
          )}>
            {severity.toUpperCase()}
          </span>
          <span className="text-xs text-[var(--muted-foreground)] font-mono">
            ID: {alertId.slice(0, 8)}...
          </span>
        </div>

        {aiVerdict && (
          <div className="flex items-start gap-2 text-sm">
            <Shield className="h-4 w-4 mt-0.5 text-[var(--terminal-green)]" />
            <span className="text-[var(--muted-foreground)]">{aiVerdict}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/soc/AlertSessionInfo.tsx
git commit -m "feat: add AlertSessionInfo component for displaying linked alert"
```

---

## Task 4: 整合 AlertSessionInfo 到 SOCAnalysisWorkspace

**Files:**
- Modify: `frontend/src/components/soc/SOCAnalysisWorkspace.tsx`

**目標:** 在調查工作台中顯示關聯告警的摘要資訊。

- [ ] **Step 1: 加入 import**

```tsx
import { AlertSessionInfo } from './AlertSessionInfo';
```

- [ ] **Step 2: 在 workspace 中加入 AlertSessionInfo**

在 session 資訊區域後加入：

```tsx
{alertData && (
  <AlertSessionInfo
    alertId={alertData.id}
    title={alertData.title}
    severity={alertData.severity}
    aiVerdict={alertData.aiVerdict}
  />
)}
```

- [ ] **Step 3: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/soc/SOCAnalysisWorkspace.tsx
git commit -m "feat: integrate AlertSessionInfo into SOCAnalysisWorkspace"
```

---

## Task 5: 修改 Alerts 頁面導向邏輯（使用 Next.js router）

**Files:**
- Modify: `frontend/src/app/alerts/page.tsx`

**目標:** 使用 Next.js router 替代 window.location.href 進行導航。

- [ ] **Step 1: 找到 handleInvestigate 函數**

- [ ] **Step 2: 修改導航方式**

```tsx
import { useRouter } from 'next/navigation';

// 在 component 內
const router = useRouter();

// 修改 handleInvestigate
const handleInvestigate = async (alertId: string) => {
  try {
    const result = await api.alerts.investigate(alertId, 'soc');
    await loadAlerts();
    setSelectedAlert(null);
    router.push(`/investigations/${result.session_id}`);
  } catch (err) {
    // 錯誤處理
  }
};
```

- [ ] **Step 3: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/alerts/page.tsx
git commit -m "refactor: use Next.js router for investigation navigation"
```

---

## Verification Checklist

完成所有 Task 後：

- [ ] `frontend/npm run lint` 無錯誤
- [ ] `frontend/npm run build` 成功
- [ ] `/investigations/[sessionId]` 路由可訪問
- [ ] Alerts 頁面「開始調查」正確導向調查工作台
- [ ] 調查工作台顯示關聯告警摘要
- [ ] 可以從 dashboard 最近事件進入調查

---

## 關鍵文件

| 文件 | 操作 | 說明 |
|------|------|------|
| `frontend/src/app/investigations/[sessionId]/page.tsx` | Create | 動態路由頁面 |
| `frontend/src/components/soc/AlertSessionInfo.tsx` | Create | 告警摘要組件 |
| `frontend/src/components/soc/SOCAnalysisWorkspace.tsx` | Modify | 支援 alert session 載入 |
| `frontend/src/app/alerts/page.tsx` | Modify | 使用 Next.js router |
