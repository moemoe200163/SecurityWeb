'use client';

import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Link from 'next/link';
import { PageHero } from '@/components/layout/PageHero';
import { UserKeyTable } from '@/components/admin/UserKeyTable';
import { api } from '@/lib/api';

interface KeyStats {
  active: number;
  revoked: number;
  noKey: number;
}

export default function AdminKeysPage() {
  const [stats, setStats] = useState<KeyStats | null>(null);

  useEffect(() => {
    api.adminKeys
      .list()
      .then((res) => {
        const keys = res.keys;
        setStats({
          active: keys.filter((k) => !k.revokedAt && k.prefix).length,
          revoked: keys.filter((k) => k.revokedAt).length,
          noKey: keys.filter((k) => !k.revokedAt && !k.prefix).length,
        });
      })
      .catch(() => setStats({ active: 0, revoked: 0, noKey: 0 }));
  }, []);

  const commandValue = stats
    ? `${stats.active} active · ${stats.revoked} revoked · ${stats.noKey} no-key`
    : 'loading...';

  return (
    <main className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<KeyRound className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Admin · API Keys"
        subtitle="USER KEY MANAGEMENT"
        command="admin keys list --filter=active"
        commandValue={commandValue}
        actions={
          <Link
            href="/admin/retention"
            className="text-sm font-mono text-[var(--terminal-green)] hover:underline"
          >
            Go to Retention →
          </Link>
        }
      />
      <div className="max-w-5xl mx-auto p-6">
        <UserKeyTable />
      </div>
    </main>
  );
}
