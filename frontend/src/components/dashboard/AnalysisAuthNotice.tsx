'use client';

import Link from 'next/link';
import { AlertTriangle, Settings } from 'lucide-react';
import type { AnalysisMetrics, MetricDelta } from '@/lib/types/dashboard';

// ---------------------------------------------------------------------------
// Shared empty metrics constant (all zeros)
// ---------------------------------------------------------------------------

const ZERO_DELTA: MetricDelta = { delta: 0, deltaPercent: null };

export const EMPTY_ANALYSIS_METRICS: AnalysisMetrics = {
  month: {
    current: { incidents: 0, successfulResolutions: 0, failedResolutions: 0, resolutionRate: 0 },
    previous: { incidents: 0, successfulResolutions: 0, failedResolutions: 0, resolutionRate: 0 },
    sameMonthLastYear: { incidents: 0, successfulResolutions: 0, failedResolutions: 0, resolutionRate: 0 },
  },
  year: {
    current: { incidents: 0, successfulResolutions: 0, failedResolutions: 0, resolutionRate: 0 },
    previous: { incidents: 0, successfulResolutions: 0, failedResolutions: 0, resolutionRate: 0 },
  },
  comparison: {
    monthOverMonth: { incidents: ZERO_DELTA, successfulResolutions: ZERO_DELTA, failedResolutions: ZERO_DELTA, resolutionRate: ZERO_DELTA },
    yearOverYear: { incidents: ZERO_DELTA, successfulResolutions: ZERO_DELTA, failedResolutions: ZERO_DELTA, resolutionRate: ZERO_DELTA },
    yearToYear: { incidents: ZERO_DELTA, successfulResolutions: ZERO_DELTA, failedResolutions: ZERO_DELTA, resolutionRate: ZERO_DELTA },
  },
};

// ---------------------------------------------------------------------------
// Non-blocking auth notice banner
// ---------------------------------------------------------------------------

interface AnalysisAuthNoticeProps {
  variant?: 'missing' | 'forbidden';
}

export function AnalysisAuthNotice({ variant = 'missing' }: AnalysisAuthNoticeProps) {
  const message =
    variant === 'forbidden'
      ? '權限不足或 API Key role 不符合，目前顯示空分析資料'
      : '尚未連接 SecurityWeb Access Key，目前顯示空分析資料';

  return (
    <div className="rounded-xl border border-[var(--terminal-amber)]/30 bg-[var(--terminal-amber)]/5 p-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 text-[var(--terminal-amber)] shrink-0" />
        <p className="text-sm text-[var(--muted-foreground)] flex-1">{message}</p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--terminal-green)]/50 transition-all shrink-0"
        >
          <Settings className="h-3 w-3" />
          前往設定 Access Key
        </Link>
      </div>
    </div>
  );
}
