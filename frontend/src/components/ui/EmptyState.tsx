'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <div className="p-4 rounded-xl bg-[var(--muted)] mb-4">
        {icon || <Inbox className="h-10 w-10 text-[var(--muted-foreground)]" />}
      </div>
      <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4 text-center max-w-md">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}