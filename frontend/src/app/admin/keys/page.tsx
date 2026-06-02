import { UserKeyTable } from '@/components/admin/UserKeyTable';

export default function AdminKeysPage() {
  return (
    <main className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-mono text-[var(--terminal-green)]">Admin · API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          List, rotate, and revoke user API keys.
        </p>
      </header>
      <UserKeyTable />
    </main>
  );
}
