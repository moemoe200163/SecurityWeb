import { UserKeyTable } from '@/components/admin/UserKeyTable';
import Link from 'next/link';

export default function AdminKeysPage() {
  return (
    <main className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-mono text-[var(--terminal-green)]">Admin · API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          List, rotate, and revoke user API keys.{' '}
          <Link href="/admin/retention" className="underline hover:text-[var(--terminal-green)]">
            Go to Retention →
          </Link>
        </p>
      </header>
      <UserKeyTable />
    </main>
  );
}
