'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStepStore } from '@/stores/stepStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useStepStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return <AppShell>{children}</AppShell>;
}
