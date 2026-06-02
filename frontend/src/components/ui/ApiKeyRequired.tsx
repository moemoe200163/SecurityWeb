'use client';

import { AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from './button';

interface ApiKeyRequiredProps {
  message?: string;
}

export function ApiKeyRequired({ message = '請先設定 API Key' }: ApiKeyRequiredProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="flex items-center gap-3 text-[var(--terminal-amber)]">
        <AlertTriangle className="h-8 w-8" />
        <span className="text-lg font-mono">{message}</span>
      </div>
      <Link href="/settings">
        <Button className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black font-medium">
          <Settings className="h-4 w-4 mr-2" />
          前往設定 API Key
        </Button>
      </Link>
    </div>
  );
}
