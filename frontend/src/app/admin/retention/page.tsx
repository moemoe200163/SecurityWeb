import { RetentionPanel } from '@/components/admin/RetentionPanel';
import Link from 'next/link';

export default function AdminRetentionPage() {
  return (
    <main className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-mono text-[var(--terminal-green)]">Admin · Retention</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run and preview data retention cleanup.{' '}
          <Link href="/admin/keys" className="underline hover:text-[var(--terminal-green)]">
            Back to API keys
          </Link>
        </p>
      </header>
      <RetentionPanel />
    </main>
  );
}
