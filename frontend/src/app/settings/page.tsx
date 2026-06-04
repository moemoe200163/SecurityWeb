'use client';

import { Terminal } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { PlatformApiKeySection } from '@/components/settings/PlatformApiKeySection';
import { BackendStatusSection } from '@/components/settings/BackendStatusSection';
import { LLMProviderSection } from '@/components/settings/LLMProviderSection';
import { MyApiKeyPanel } from '@/components/settings/MyApiKeyPanel';

export default function SettingsPage() {
  return (
    <div className="min-h-full animate-fade-in-up">
      <PageHero
        icon={<Terminal className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="系統設定"
        subtitle="SYSTEM CONFIGURATION"
        command="config --list"
      />

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <PlatformApiKeySection />
        <BackendStatusSection />
        <LLMProviderSection />
        <MyApiKeyPanel />
      </div>
    </div>
  );
}
