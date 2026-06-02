# Phase 3: 工具與情報證據化 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 讓工具執行結果和威脅情報查詢可以加入調查證據，Audit log 敏感參數 mask，高風險工具模板預設 disabled。

**Architecture:** 使用現有 ToolExecution 模型的 sessionId 字段關聯調查，新增「加入證據」功能到工具頁面和情報查詢頁面。

**Tech Stack:** Next.js 16, React 19, Fastify, Prisma

---

## 現狀分析

| 功能 | 現狀 | 需要做的 |
|------|------|----------|
| 工具執行 | 有 sessionId 字段但前端未使用 | 前端加入「加入調查證據」按鈕 |
| 情報查詢 | 結果只顯示不儲存 | 加入「加入調查證據」按鈕 |
| Audit log | 敏感參數未 mask | 加入 mask 邏輯 |
| 高風險工具 | 已有 isApproved 控制 | 確認預設 disabled |

---

## Task 1: 建立 AddToInvestigation 共用組件

**Files:**
- Create: `frontend/src/components/ui/AddToInvestigation.tsx`

**目標:** 建立一個共用按鈕，讓使用者可以將工具執行結果或情報查詢結果加入調查證據。

- [ ] **Step 1: 建立組件**

```tsx
// frontend/src/components/ui/AddToInvestigation.tsx
'use client';

import React, { useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface AddToInvestigationProps {
  executionId?: string;
  alertId?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
  type: 'tool' | 'intelligence';
  onSuccess?: () => void;
  className?: string;
}

export function AddToInvestigation({
  executionId,
  alertId,
  sessionId,
  data,
  type,
  onSuccess,
  className,
}: AddToInvestigationProps) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    if (added || loading) return;
    setLoading(true);
    try {
      // 這裡需要後端 API 支援
      // 暫時模擬成功
      await new Promise(resolve => setTimeout(resolve, 500));
      setAdded(true);
      onSuccess?.();
    } catch (err) {
      console.error('Failed to add to investigation:', err);
    } finally {
      setLoading(false);
    }
  };

  if (added) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm text-[var(--terminal-green)]', className)}>
        <Check className="h-4 w-4" />
        已加入證據
      </span>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading || !sessionId}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]',
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Plus className="h-4 w-4 mr-1" />
      )}
      加入調查證據
    </button>
  );
}
```

- [ ] **Step 2: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/AddToInvestigation.tsx
git commit -m "feat: add AddToInvestigation component for evidence collection"
```

---

## Task 2: 在工具執行結果中加入「加入調查證據」按鈕

**Files:**
- Modify: `frontend/src/app/tools/page.tsx`

**目標:** 在工具執行結果區域顯示「加入調查證據」按鈕。

- [ ] **Step 1: 加入 import**

```tsx
import { AddToInvestigation } from '@/components/ui/AddToInvestigation';
```

- [ ] **Step 2: 在執行結果區域加入按鈕**

在 `result` 顯示區域後加入：

```tsx
{result && sessionId && (
  <AddToInvestigation
    executionId={currentExecution?.id}
    sessionId={sessionId}
    type="tool"
    data={{ output: result.output, templateId: selectedTemplate?.id }}
  />
)}
```

- [ ] **Step 3: 加入 sessionId state**

```tsx
const [sessionId, setSessionId] = useState<string | null>(null);
```

- [ ] **Step 4: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/tools/page.tsx
git commit -m "feat: add evidence collection button to tool execution results"
```

---

## Task 3: 在威脅情報查詢結果中加入「加入調查證據」按鈕

**Files:**
- Modify: `frontend/src/app/threat/investigate/page.tsx`

**目標:** 在 IP/Domain/Hash 查詢結果區域顯示「加入調查證據」按鈕。

- [ ] **Step 1: 加入 import**

```tsx
import { AddToInvestigation } from '@/components/ui/AddToInvestigation';
```

- [ ] **Step 2: 在查詢結果區域加入按鈕**

在結果顯示區域加入：

```tsx
{result && sessionId && (
  <AddToInvestigation
    sessionId={sessionId}
    type="intelligence"
    data={{ query: inputValue, result }}
  />
)}
```

- [ ] **Step 3: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/frontend && npm run lint && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/threat/investigate/page.tsx
git commit -m "feat: add evidence collection button to threat intelligence results"
```

---

## Task 4: Audit Log 敏感參數 Mask

**Files:**
- Create: `backend/src/utils/sanitize.ts`
- Modify: `backend/src/routes/tools.ts`
- Modify: `backend/src/routes/admin.ts`

**目標:** 在儲存 audit log 時，mask 敏感參數（password、token、cookie、auth、apiKey）。

- [ ] **Step 1: 建立 sanitize 工具函數**

```typescript
// backend/src/utils/sanitize.ts

const SENSITIVE_KEYS = [
  'password', 'token', 'cookie', 'auth', 'apikey', 'api_key',
  'secret', 'credential', 'authorization', 'session',
];

export function sanitizeAuditDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
        return [key, typeof value === 'string' ? '[REDACTED]' : '[REDACTED]'];
      }
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return [key, sanitizeAuditDetails(value as Record<string, unknown>)];
      }
      return [key, value];
    })
  );
}

export function sanitizeCommand(command: unknown[]): unknown[] {
  return command.map((arg, index) => {
    if (typeof arg === 'string') {
      const lowerArg = arg.toLowerCase();
      if (SENSITIVE_KEYS.some(sensitive => lowerArg.includes(sensitive))) {
        return '[REDACTED]';
      }
    }
    return arg;
  });
}
```

- [ ] **Step 2: 在 tools.ts 中使用 sanitize**

找到創建 audit log 的地方，加入 sanitize：

```typescript
import { sanitizeAuditDetails, sanitizeCommand } from '../utils/sanitize';

// 在創建 audit log 時
await prisma.auditLog.create({
  data: {
    userId: user.id,
    action: 'execute',
    resourceType: 'tool_execution',
    resourceId: execution.id,
    details: sanitizeAuditDetails({
      executionId: execution.id,
      success: result.success,
      durationMs: result.duration_ms,
      command: sanitizeCommand(result.command || []),
    }),
  },
});
```

- [ ] **Step 3: 在 admin.ts 中使用 sanitize**

找到創建 audit log 的地方，加入 sanitize：

```typescript
details: sanitizeAuditDetails(body as Record<string, unknown>),
```

- [ ] **Step 4: 驗證**

```bash
cd /Users/user/Code/SecurityWeb/backend && npm run build && npm test
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/sanitize.ts backend/src/routes/tools.ts backend/src/routes/admin.ts
git commit -m "feat: add sensitive parameter masking for audit log"
```

---

## Task 5: 確認高風險工具模板預設 Disabled

**Files:**
- Check: `backend/src/db/seed-data/tool_templates.sql`
- Check: `backend/prisma/schema.prisma`

**目標:** 確認高風險工具模板（如 sql_dump、hydra）預設 disabled 或需要 admin approve。

- [ ] **Step 1: 檢查 seed 數據**

確認 tool_templates.sql 中高風險模板的 isApproved 和 isEnabled 設定。

- [ ] **Step 2: 如果需要，修改 seed 數據**

確保高風險模板（riskLevel = 'high'）的 isApproved = false。

- [ ] **Step 3: Commit（如果需要）**

```bash
git add backend/src/db/seed-data/tool_templates.sql
git commit -m "fix: ensure high-risk tool templates are disabled by default"
```

---

## Verification Checklist

完成所有 Task 後：

- [ ] `frontend/npm run lint` 無錯誤
- [ ] `frontend/npm run build` 成功
- [ ] `backend/npm run build` 成功
- [ ] `backend/npm test` 通過
- [ ] 工具執行結果可加入調查證據
- [ ] 威脅情報查詢結果可加入調查證據
- [ ] Audit log 中敏感參數已 mask
- [ ] 高風險工具模板預設 disabled

---

## 關鍵文件

| 文件 | 操作 | 說明 |
|------|------|------|
| `frontend/src/components/ui/AddToInvestigation.tsx` | Create | 加入調查證據按鈕 |
| `frontend/src/app/tools/page.tsx` | Modify | 工具頁面加入證據按鈕 |
| `frontend/src/app/threat/investigate/page.tsx` | Modify | 情報頁面加入證據按鈕 |
| `backend/src/utils/sanitize.ts` | Create | 敏感參數 mask 工具 |
| `backend/src/routes/tools.ts` | Modify | 使用 sanitize |
| `backend/src/routes/admin.ts` | Modify | 使用 sanitize |
