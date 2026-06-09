'use client';

import type { AnalysisMetrics, MetricDelta } from '@/lib/types/dashboard';
import { AuthNotice } from '@/components/ui/AuthNotice';

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

/**
 * @deprecated Use AuthNotice with mode="banner" instead.
 * Kept for backward compatibility with dashboard pages.
 */
export function AnalysisAuthNotice({ variant = 'missing' }: AnalysisAuthNoticeProps) {
  return <AuthNotice variant={variant} mode="banner" />;
}
