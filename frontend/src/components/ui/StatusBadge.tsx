'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-500',
  },
  danger: {
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
  },
  muted: {
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
    border: 'border-gray-500/30',
    dot: 'bg-gray-500',
  },
  outline: {
    bg: 'bg-transparent',
    text: 'text-[var(--foreground)]',
    border: 'border-[var(--border)]',
    dot: 'bg-[var(--muted-foreground)]',
  },
};

export function StatusBadge({ variant, children, className, dot = false }: StatusBadgeProps) {
  const styles = variantClasses[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />}
      {children}
    </span>
  );
}