'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = '載入中...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-[var(--terminal-green)] mb-4" />
      <span className="text-sm text-[var(--muted-foreground)]">{message}</span>
    </div>
  );
}