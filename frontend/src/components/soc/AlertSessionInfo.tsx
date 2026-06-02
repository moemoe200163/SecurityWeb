'use client';

import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
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
