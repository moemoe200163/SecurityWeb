'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface PageHeroProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  command?: string;
  commandValue?: string;
  accentClassName?: string;
  actions?: ReactNode;
}

export function PageHero({
  icon,
  title,
  subtitle,
  command = 'current_time --zone=Asia/Taipei',
  commandValue,
  accentClassName = 'text-[var(--terminal-green)] bg-[var(--terminal-green)]/10',
  actions,
}: PageHeroProps) {
  const [fallbackValue, setFallbackValue] = useState('');

  useEffect(() => {
    if (commandValue) return;
    setFallbackValue(new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
    }));
  }, [commandValue]);

  const displayValue = commandValue ?? fallbackValue;

  return (
    <div className="relative min-h-[152px] border-b border-[var(--border)] px-6 py-8 animate-fade-in-up">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:50px_50px] opacity-30" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--terminal-green)]/20 to-transparent" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-xl ${accentClassName}`}>
              {icon}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] font-mono tracking-tight">
                {title}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)] font-mono">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 font-mono text-xs text-[var(--muted-foreground)]">
            <span className="text-[var(--terminal-green)]">$</span> {command}
            <span className="text-[var(--terminal-green)]">{displayValue}</span>
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-3 sm:pt-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
