'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { CodeBlock } from '@/components/ui/CodeBlock';
import type { Step, StepStatus } from '@/lib/types';

const statusConfig: Record<StepStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <Circle className="h-4 w-4" />,
    color: 'text-[var(--muted-foreground)]',
    label: '待執行',
  },
  running: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: 'text-blue-500',
    label: '執行中',
  },
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-500',
    label: '已完成',
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-red-500',
    label: '錯誤',
  },
};

const borderColors: Record<StepStatus, string> = {
  pending: 'border-[var(--border)]',
  running: 'border-blue-500',
  success: 'border-green-500',
  error: 'border-red-500',
};

interface StepCardProps {
  step: Step;
  isLast?: boolean;
}

export function StepCard({ step, isLast = false }: StepCardProps) {
  const [isOpen, setIsOpen] = useState(step.status === 'running' || step.status === 'success' || step.status === 'error');
  const config = statusConfig[step.status];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="relative">
      {/* Timeline connector */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-5 top-12 w-0.5 h-full -translate-x-1/2',
            step.status === 'success' ? 'bg-green-500' : 'bg-[var(--border)]'
          )}
        />
      )}

      <div className="flex gap-4">
        {/* Status indicator */}
        <div className={cn('relative z-10 flex-shrink-0', config.color)}>
          {step.status === 'running' ? (
            <div className="h-10 w-10 rounded-full border-2 border-blue-500 bg-[var(--card)] flex items-center justify-center">
              {config.icon}
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-[var(--card)] flex items-center justify-center border-2 border-current">
              {config.icon}
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn('flex-1 border-l-4 rounded-lg bg-[var(--card)] shadow-sm overflow-hidden', borderColors[step.status])}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-[var(--foreground)]">{step.title}</h3>
                <Badge
                  variant={step.status === 'success' ? 'default' : step.status === 'running' ? 'secondary' : 'outline'}
                  className={cn(
                    'text-xs',
                    step.status === 'success' && 'bg-green-500/10 text-green-500 hover:bg-green-500/10',
                    step.status === 'running' && 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/10'
                  )}
                >
                  {config.icon}
                  <span className="ml-1">{config.label}</span>
                </Badge>
              </div>
              <CollapsibleTrigger
                className="p-1 hover:bg-[var(--muted)] rounded-md transition-colors"
                aria-label={isOpen ? '收起詳細內容' : '展開詳細內容'}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                )}
              </CollapsibleTrigger>
            </div>

            {step.content && (
              <div className="mt-2">
                <MarkdownRenderer content={step.content} />
              </div>
            )}

            {step.timestamp && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {new Date(step.timestamp).toLocaleTimeString('zh-TW')}
              </p>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-t border-[var(--border)] px-4 py-4 space-y-4 bg-[var(--muted)]/40">
              {/* Code block */}
              {step.codeBlock && (
                <CodeBlock
                  code={step.codeBlock}
                  language="bash"
                  maxHeight="max-h-[400px]"
                />
              )}

              {/* Tool calls */}
              {step.toolCalls && step.toolCalls.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                    工具調用
                  </h4>
                  {step.toolCalls.map((tool, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'border rounded-lg p-3 text-xs',
                        tool.status === 'calling' ? 'border-blue-500/30 bg-blue-500/10' :
                        tool.status === 'success' ? 'border-green-500/30 bg-green-500/10' :
                        'border-red-500/30 bg-red-500/10'
                      )}
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          tool.status === 'calling' ? 'bg-blue-500 animate-pulse' :
                          tool.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                        )} />
                        {tool.toolName}
                      </div>
                      {tool.params && (
                        <pre className="mt-2 text-[var(--muted-foreground)] overflow-x-auto">
                          {JSON.stringify(tool.params, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
