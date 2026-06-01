'use client';

import Plan from '@/components/ui/agent-plan';
import { Terminal, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';

export default function AgentPlanDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PageHero
        icon={<Terminal className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="Agent Plan"
        subtitle="AI TASK ORCHESTRATION"
        command="./agent-task --mode"
        commandValue="interactive"
      />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[var(--terminal-green)]" />
            <span className="text-sm font-mono text-[var(--terminal-green)]">$</span>
            <span className="text-sm text-[var(--muted-foreground)] font-mono">AI Task Orchestration Interface</span>
          </div>
          <p className="text-[var(--muted-foreground)] text-sm ml-8">
            點擊任務方塊切換狀態 · 展開查看子任務 · MCP 伺服器工具追蹤
          </p>
        </div>

        {/* Agent Plan Component */}
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Plan />
        </div>

        {/* Usage Guide */}
        <div className="mt-6 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-[var(--terminal-green)]">$</span>
            <span className="text-sm font-medium text-[var(--foreground)]">操作說明</span>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted-foreground)] font-mono ml-6">
            <p>· 點擊任務圖標可以循環切換狀態 (pending → in-progress → completed → need-help → failed)</p>
            <p>· 點擊任務名稱可以展開/摺疊子任務列表</p>
            <p>· 點擊子任務圖標可以標記完成/未完成</p>
            <p>· 展開子任務可查看描述和 MCP 工具標籤</p>
            <p>· 支援動畫和 reduced-motion 無障礙模式</p>
          </div>
        </div>
      </div>
    </div>
  );
}
