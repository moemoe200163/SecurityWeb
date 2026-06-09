'use client';

import Link from 'next/link';
import { AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthNoticeProps {
  /** 'missing' = 401 (no key or invalid), 'forbidden' = 403 (key lacks role) */
  variant?: 'missing' | 'forbidden';
  /** 'banner' = inline notice, 'blocking' = full-page centered */
  mode?: 'banner' | 'blocking';
  /** Override default message */
  message?: string;
  /** Hide the settings link */
  hideAction?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGES: Record<NonNullable<AuthNoticeProps['variant']>, Record<NonNullable<AuthNoticeProps['mode']>, string>> = {
  missing: {
    banner: '尚未連接 SecurityWeb Access Key，目前顯示空資料',
    blocking: '請先設定 SecurityWeb Access Key',
  },
  forbidden: {
    banner: '權限不足或 API Key role 不符合，目前顯示空資料',
    blocking: '權限不足或 API Key role 不符合',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuthNotice({
  variant = 'missing',
  mode = 'banner',
  message,
  hideAction = false,
  className,
}: AuthNoticeProps) {
  const displayMessage = message ?? MESSAGES[variant][mode];

  // --- Blocking mode: full-page centered ---
  if (mode === 'blocking') {
    return (
      <div className={cn('flex flex-col items-center justify-center min-h-[400px] gap-4', className)}>
        <div className="flex items-center gap-3 text-[var(--terminal-amber)]">
          <AlertTriangle className="h-8 w-8" />
          <span className="text-lg font-mono">{displayMessage}</span>
        </div>
        {!hideAction && (
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium transition-colors"
          >
            <Settings className="h-4 w-4" />
            前往設定 Access Key
          </Link>
        )}
      </div>
    );
  }

  // --- Banner mode: inline notice ---
  return (
    <div className={cn(
      'rounded-xl border border-[var(--terminal-amber)]/30 bg-[var(--terminal-amber)]/5 p-4',
      className,
    )}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-[var(--terminal-amber)] shrink-0" />
        <p className="text-sm text-[var(--muted-foreground)] flex-1">{displayMessage}</p>
        {!hideAction && (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--terminal-green)]/50 transition-all shrink-0"
          >
            <Settings className="h-3 w-3" />
            前往設定 Access Key
          </Link>
        )}
      </div>
    </div>
  );
}
