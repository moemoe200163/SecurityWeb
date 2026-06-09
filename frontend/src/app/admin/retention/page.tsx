'use client';

import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { RetentionPanel } from '@/components/admin/RetentionPanel';
import { api } from '@/lib/api';
import { formatTaipeiDateTime } from '@/lib/datetime';

export default function AdminRetentionPage() {
  const [lastRunAt, setLastRunAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api.adminRetention
      .status()
      .then((res) => setLastRunAt(res.lastRunAt))
      .catch(() => setLastRunAt(null));
  }, []);

  const commandValue =
    lastRunAt === undefined
      ? 'loading...'
      : lastRunAt === null
        ? 'never'
        : formatTaipeiDateTime(lastRunAt);

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Database className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · Retention"
        subtitle="DATA RETENTION MANAGEMENT"
        command="retention status --last-run"
        commandValue={commandValue}
        actions={
          <Link
            href="/admin/keys"
            className="text-sm font-mono text-[var(--terminal-green)] hover:underline"
          >
            ← Back to API keys
          </Link>
        }
      />
      <div className="max-w-5xl mx-auto p-6">
        <RetentionPanel />
      </div>
    </main>
  );
}
