'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  children,
  className,
  headerAction,
  noPadding = false,
}: SectionCardProps) {
  return (
    <div className={cn('bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden', className)}>
      {title && (
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-medium text-[var(--foreground)]">{title}</h3>
          {headerAction}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </div>
  );
}