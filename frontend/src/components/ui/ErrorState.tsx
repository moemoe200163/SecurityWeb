'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = '發生錯誤',
  message = '無法載入資料，請稍後再試',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
      <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)] mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          重試
        </Button>
      )}
    </div>
  );
}