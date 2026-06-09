'use client';

import { Terminal, Key, Server } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { PlatformApiKeySection } from '@/components/settings/PlatformApiKeySection';
import { BackendStatusSection } from '@/components/settings/BackendStatusSection';
import { LLMProviderSection } from '@/components/settings/LLMProviderSection';
import { MyApiKeyPanel } from '@/components/settings/MyApiKeyPanel';

function SectionGroup({
  icon,
  label,
  command,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  command: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">{label}</h2>
        <span className="text-xs font-mono text-[var(--muted-foreground)] ml-auto">{command}</span>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Terminal className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="系統設定"
        subtitle="SYSTEM CONFIGURATION"
        command="config --list"
      />

      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <SectionGroup
          icon={<Key className="h-4 w-4 text-[var(--terminal-green)]" />}
          label="存取設定"
          command="config --auth"
        >
          <PlatformApiKeySection />
          <MyApiKeyPanel />
        </SectionGroup>

        <SectionGroup
          icon={<Server className="h-4 w-4 text-[var(--terminal-green)]" />}
          label="基礎設施"
          command="config --infra"
        >
          <BackendStatusSection />
          <LLMProviderSection />
        </SectionGroup>
      </div>
    </div>
  );
}
