'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  accentColor?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  trend,
  trendUp = true,
  accentColor = 'bg-[var(--terminal-green)]/10',
  className,
}: MetricCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 group hover:border-[var(--terminal-green)]/50 transition-all duration-300',
      className
    )}>
      {/* Subtle scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div className={cn('p-2 rounded-lg', accentColor)}>
              {icon}
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold font-mono text-[var(--foreground)]">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-mono',
              trendUp ? 'text-emerald-500' : 'text-red-500'
            )}>
              {trendUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}