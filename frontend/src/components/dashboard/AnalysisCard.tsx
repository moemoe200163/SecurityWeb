'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetricDelta } from '@/lib/types/dashboard';

interface AnalysisCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accentColor: string;
  mom: MetricDelta;
  yoy: MetricDelta;
  invertTrend?: boolean;
  valueSuffix?: string;
  className?: string;
}

type TrendDirection = 'up' | 'down' | 'neutral';

interface FormattedDelta {
  text: string;
  direction: TrendDirection;
}

function formatDelta(delta: MetricDelta, invert: boolean): FormattedDelta {
  const { delta: d, deltaPercent } = delta;
  if (d === 0) return { text: '\u6301\u5e73', direction: 'neutral' };
  if (deltaPercent === null) {
    if (d > 0) {
      return { text: '\u65b0\u589e', direction: invert ? 'down' : 'up' };
    }
    return { text: '\u7121\u57fa\u6e96', direction: 'neutral' };
  }
  const sign = d > 0 ? '+' : '';
  const rawDirection: TrendDirection = d > 0 ? 'up' : 'down';
  const direction: TrendDirection = invert
    ? (rawDirection === 'up' ? 'down' : 'up')
    : rawDirection;
  return { text: `${sign}${d} (${sign}${deltaPercent}%)`, direction };
}

function TrendPill({ delta, label, invert }: { delta: MetricDelta; label: string; invert: boolean }) {
  const { text, direction } = formatDelta(delta, invert);
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      {direction === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500" />}
      {direction === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
      {direction === 'neutral' && <Minus className="h-3 w-3 text-[var(--muted-foreground)]" />}
      <span className={cn(
        direction === 'up' && 'text-emerald-500',
        direction === 'down' && 'text-red-500',
        direction === 'neutral' && 'text-[var(--muted-foreground)]',
      )}>
        {label}: {text}
      </span>
    </div>
  );
}

export function AnalysisCard({
  label,
  value,
  icon,
  accentColor,
  mom,
  yoy,
  invertTrend = false,
  valueSuffix,
  className,
}: AnalysisCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 group hover:border-[var(--terminal-green)]/50 transition-all duration-300',
      className,
    )}>
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{label}</span>
          <div className={cn('p-2 rounded-lg', accentColor)}>{icon}</div>
        </div>
        <div className="mb-3">
          <span className="text-3xl font-bold font-mono text-[var(--foreground)]">
            {displayValue}{valueSuffix ?? ''}
          </span>
        </div>
        <div className="space-y-1.5">
          <TrendPill delta={mom} label="vs \u4e0a\u6708" invert={invertTrend} />
          <TrendPill delta={yoy} label="vs \u53bb\u5e74" invert={invertTrend} />
        </div>
      </div>
    </div>
  );
}
