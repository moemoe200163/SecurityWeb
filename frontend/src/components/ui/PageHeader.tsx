'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  accentColor?: 'green' | 'red' | 'blue' | 'yellow' | 'purple';
  actions?: React.ReactNode;
  className?: string;
}

const accentClasses = {
  green: {
    bg: 'bg-[var(--terminal-green)]/10',
    border: 'border-[var(--terminal-green)]/30',
    icon: 'text-[var(--terminal-green)]',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-500',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-500',
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-500',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-500',
  },
};

export function PageHeader({
  title,
  description,
  icon,
  accentColor = 'green',
  actions,
  className,
}: PageHeaderProps) {
  const accent = accentClasses[accentColor];

  return (
    <div className={cn('bg-[var(--card)] border-b border-[var(--border)] px-6 py-4', className)}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn('p-2 rounded-lg border', accent.bg, accent.border)}>
                <span className={accent.icon}>{icon}</span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-[var(--foreground)]">{title}</h1>
              {description && (
                <p className="text-sm text-[var(--muted-foreground)] font-mono mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}