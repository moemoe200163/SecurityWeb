'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function BackendStatusSection() {
  const [health, setHealth] = useState<'checking' | 'ok' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    api.health()
      .then(() => setHealth('ok'))
      .catch((err) => {
        setHealth('error');
        setErrorMsg(err instanceof Error ? err.message : '無法連線');
      });
  }, []);

  return (
    <SectionCard title="Backend API Endpoint">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <code className="flex-1 text-sm font-mono text-[var(--foreground)] bg-[var(--background)] px-3 py-2 rounded-lg">
            {API_BASE}
          </code>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono">
          {health === 'checking' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
              <span className="text-[var(--muted-foreground)]">檢查中...</span>
            </>
          )}
          {health === 'ok' && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--terminal-green)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--terminal-green)]" />
              </span>
              <span className="text-[var(--terminal-green)]">Connected</span>
            </>
          )}
          {health === 'error' && (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-500">Unreachable</span>
              {errorMsg && (
                <span className="text-xs text-[var(--muted-foreground)] ml-1">({errorMsg})</span>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
