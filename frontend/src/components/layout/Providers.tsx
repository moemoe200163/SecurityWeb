'use client';

import { AppShell } from '@/components/layout/AppShell';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
