'use client';

import React from 'react';
import { AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface ApiKeyRequiredProps {
  message?: string;
  className?: string;
}

export function ApiKeyRequired({ message = '請先設定 SecurityWeb Access Key', className }: ApiKeyRequiredProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-[400px] gap-4', className)}>
      <div className="flex items-center gap-3 text-[var(--terminal-amber)]">
        <AlertTriangle className="h-8 w-8" />
        <span className="text-lg font-mono">{message}</span>
      </div>
      <Link href="/settings" className={buttonVariants({ className: 'bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium' })}>
        <Settings className="h-4 w-4 mr-2" />
        前往設定 Access Key
      </Link>
    </div>
  );
}
