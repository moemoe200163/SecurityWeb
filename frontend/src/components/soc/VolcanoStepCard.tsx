'use client';

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from '@/lib/types';

interface VolcanoStepCardProps {
  step: Step;
  stepNumber: number;
  isLast?: boolean;
}

export function VolcanoStepCard({ step, stepNumber, isLast = false }: VolcanoStepCardProps) {
  const status = step.status;

  return (
    <div className="relative">
      {/* Timeline vertical line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-6 top-14 w-0.5 h-full -translate-x-1/2 transition-colors duration-500',
            step.status === 'success' ? 'bg-emerald-500' : 'bg-[var(--border)]'
          )}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Left status icon */}
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
          status === 'success' && 'bg-emerald-500/10 text-emerald-600',
          status === 'running' && 'bg-[--color-soc] text-white',
          status === 'pending' && 'bg-[var(--muted)] text-[var(--muted-foreground)]',
          status === 'error' && 'bg-red-500/10 text-red-500'
        )}>
          {status === 'success' && <CheckCircle2 className="h-5 w-5" />}
          {status === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
          {status === 'pending' && <Circle className="h-5 w-5" />}
          {status === 'error' && <XCircle className="h-5 w-5" />}
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--card-foreground)]">{step.title}</p>
          {step.content && status === 'success' && (
            <p className="text-sm text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
              {step.content.split('\n')[0]}
            </p>
          )}
          {status === 'running' && (
            <p className="text-sm text-[--color-soc] mt-0.5">處理中...</p>
          )}
        </div>

        {/* Right step number */}
        <div className="h-6 w-6 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] text-xs font-medium flex items-center justify-center flex-shrink-0">
          {stepNumber}
        </div>
      </div>
    </div>
  );
}