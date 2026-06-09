'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, isAuthError, isForbidden } from '@/lib/api';
import type { AnalysisMetrics, MetricPeriod, MetricDelta } from '@/lib/types/dashboard';
import { PageHero } from '@/components/layout/PageHero';
import { AnalysisCard } from '@/components/dashboard/AnalysisCard';
import { EMPTY_ANALYSIS_METRICS, AnalysisAuthNotice } from '@/components/dashboard/AnalysisAuthNotice';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewStatus = 'loading' | 'error' | 'empty' | 'ready';

interface DeltaIndicatorProps {
  delta: MetricDelta;
  invert?: boolean;
}

interface PeriodRow {
  label: string;
  data: MetricPeriod;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRate(rate: number): string {
  return `${rate}%`;
}

function deltaDirection(delta: MetricDelta, invert: boolean): 'up' | 'down' | 'neutral' {
  if (delta.delta === 0) return 'neutral';
  if (delta.delta > 0) return invert ? 'down' : 'up';
  return invert ? 'up' : 'down';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeltaIndicator({ delta, invert = false }: DeltaIndicatorProps) {
  const direction = deltaDirection(delta, invert);
  const { delta: d, deltaPercent } = delta;

  if (d === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-[var(--muted-foreground)]">
        <Minus className="h-3 w-3" />
        持平
      </span>
    );
  }

  const sign = d > 0 ? '+' : '';
  const pctText = deltaPercent !== null ? ` (${sign}${deltaPercent}%)` : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-mono',
        direction === 'up' && 'text-emerald-500',
        direction === 'down' && 'text-red-500',
        direction === 'neutral' && 'text-[var(--muted-foreground)]',
      )}
    >
      {direction === 'up' && <TrendingUp className="h-3 w-3" />}
      {direction === 'down' && <TrendingDown className="h-3 w-3" />}
      {direction === 'neutral' && <Minus className="h-3 w-3" />}
      {sign}{d}{pctText}
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16 mb-3" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// YearComparisonCard
// ---------------------------------------------------------------------------

function YearComparisonCard({ data }: { data: AnalysisMetrics }) {
  const { year, comparison } = data;
  const yoy = comparison.yearToYear;

  const rows: { label: string; delta: MetricDelta; invert: boolean }[] = [
    { label: '事故同比', delta: yoy.incidents, invert: true },
    { label: '成功解除同比', delta: yoy.successfulResolutions, invert: false },
    { label: '失敗解除同比', delta: yoy.failedResolutions, invert: true },
    { label: '解除率同比', delta: yoy.resolutionRate, invert: false },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px]" />
      </div>

      <div className="relative z-10">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">
          今年 vs 去年
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* This year */}
          <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
            <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider">
              今年
            </span>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">事故</span>
                <span className="font-mono font-bold text-[var(--foreground)]">
                  {year.current.incidents.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">解除率</span>
                <span className="font-mono font-bold text-[var(--terminal-green)]">
                  {formatRate(year.current.resolutionRate)}
                </span>
              </div>
            </div>
          </div>

          {/* Last year */}
          <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
            <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider">
              去年
            </span>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">事故</span>
                <span className="font-mono font-bold text-[var(--foreground)]">
                  {year.previous.incidents.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">解除率</span>
                <span className="font-mono font-bold text-[var(--muted-foreground)]">
                  {formatRate(year.previous.resolutionRate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* YoY deltas */}
        <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">{row.label}</span>
              <DeltaIndicator delta={row.delta} invert={row.invert} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeriodTable
// ---------------------------------------------------------------------------

function PeriodTable({ data }: { data: AnalysisMetrics }) {
  const periods: PeriodRow[] = [
    { label: '本月', data: data.month.current },
    { label: '上月', data: data.month.previous },
    { label: '去年同月', data: data.month.sameMonthLastYear },
    { label: '今年', data: data.year.current },
    { label: '去年', data: data.year.previous },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--foreground)]">五期比較</h3>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--background)]">
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider">期間</span>
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider text-right">事故數</span>
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider text-right">成功解除</span>
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider text-right">失敗解除</span>
        <span className="text-xs font-mono text-[var(--muted-foreground)] uppercase tracking-wider text-right">解除率</span>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-[var(--border)]">
        {periods.map((period) => (
          <div
            key={period.label}
            className="grid grid-cols-5 gap-2 px-5 py-3 hover:bg-[var(--accent)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--foreground)]">
              {period.label}
            </span>
            <span className="text-sm font-mono text-[var(--foreground)] text-right">
              {period.data.incidents.toLocaleString()}
            </span>
            <span className="text-sm font-mono text-emerald-500 text-right">
              {period.data.successfulResolutions.toLocaleString()}
            </span>
            <span className="text-sm font-mono text-orange-500 text-right">
              {period.data.failedResolutions.toLocaleString()}
            </span>
            <span className="text-sm font-mono text-blue-400 text-right">
              {formatRate(period.data.resolutionRate)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalysisPage() {
  const [status, setStatus] = useState<ViewStatus>('loading');
  const [analysis, setAnalysis] = useState<AnalysisMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [authNotice, setAuthNotice] = useState<'missing' | 'forbidden' | null>(null);

  const fetchData = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    setAuthNotice(null);
    try {
      const response = await api.dashboard.stats();
      const metrics = response.metrics.analysis;
      if (!metrics) {
        setStatus('empty');
        return;
      }
      setAnalysis(metrics);
      setStatus('ready');
    } catch (err) {
      if (isForbidden(err)) {
        setAuthNotice('forbidden');
        setAnalysis(EMPTY_ANALYSIS_METRICS);
        setStatus('ready');
        return;
      }
      if (isAuthError(err)) {
        setAuthNotice('missing');
        setAnalysis(EMPTY_ANALYSIS_METRICS);
        setStatus('ready');
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : '無法載入分析資料',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero */}
      <PageHero
        icon={<BarChart3 className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="營運分析"
        subtitle="ANALYSIS COMMAND CENTER"
        actions={
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--terminal-green)]/50 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首頁
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Auth notice (non-blocking) */}
        {authNotice && <AnalysisAuthNotice variant={authNotice} />}

        {/* KPI Cards */}
        {status === 'loading' ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : status === 'error' ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-400 mb-4">{errorMessage || '無法載入分析資料'}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              重試
            </button>
          </div>
        ) : status === 'empty' ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)] opacity-50" />
            <p className="text-sm text-[var(--muted-foreground)] mb-4">尚無分析資料</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              重新載入
            </button>
          </div>
        ) : analysis ? (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <AnalysisCard
                label="本月事故"
                value={analysis.month.current.incidents}
                icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
                accentColor="bg-red-500/10"
                mom={analysis.comparison.monthOverMonth.incidents}
                yoy={analysis.comparison.yearOverYear.incidents}
                invertTrend
                href="/alerts"
              />
              <AnalysisCard
                label="成功解除"
                value={analysis.month.current.successfulResolutions}
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                accentColor="bg-emerald-500/10"
                mom={analysis.comparison.monthOverMonth.successfulResolutions}
                yoy={analysis.comparison.yearOverYear.successfulResolutions}
                href="/alerts?status=resolved"
              />
              <AnalysisCard
                label="失敗解除"
                value={analysis.month.current.failedResolutions}
                icon={<XCircle className="h-5 w-5 text-orange-400" />}
                accentColor="bg-orange-500/10"
                mom={analysis.comparison.monthOverMonth.failedResolutions}
                yoy={analysis.comparison.yearOverYear.failedResolutions}
                invertTrend
                href="/alerts?status=failed_resolution"
              />
              <AnalysisCard
                label="解除率"
                value={analysis.month.current.resolutionRate}
                icon={<BarChart3 className="h-5 w-5 text-blue-400" />}
                accentColor="bg-blue-500/10"
                mom={analysis.comparison.monthOverMonth.resolutionRate}
                yoy={analysis.comparison.yearOverYear.resolutionRate}
                valueSuffix="%"
                href="/alerts"
              />
            </div>

            {/* Year Comparison + Period Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <YearComparisonCard data={analysis} />
              <PeriodTable data={analysis} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
