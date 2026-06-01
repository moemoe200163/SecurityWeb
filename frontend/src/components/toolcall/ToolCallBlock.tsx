'use client';

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CodeBlockInline } from '@/components/ui/CodeBlock';
import type { ToolCall } from '@/lib/types';

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const statusIcon = {
    calling: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-colors',
        toolCall.status === 'calling' && 'border-blue-500/30 bg-blue-500/10',
        toolCall.status === 'success' && 'border-green-500/30 bg-green-500/10',
        toolCall.status === 'error' && 'border-red-500/30 bg-red-500/10'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon[toolCall.status]}
          <span className="font-mono text-sm font-medium">
            {toolCall.toolName}
          </span>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {toolCall.status === 'calling' && '調用中...'}
          {toolCall.status === 'success' && '成功'}
          {toolCall.status === 'error' && '失敗'}
        </span>
      </div>

      {toolCall.params && (
        <div className="mt-3">
          <p className="text-xs text-[var(--muted-foreground)] mb-1 font-medium">參數</p>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]/50 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--muted-foreground)]">JSON</span>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(toolCall.params, null, 2))}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                複製
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-[var(--foreground)] bg-[var(--background)] overflow-x-auto">
              {JSON.stringify(toolCall.params, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {toolCall.result != null && (
        <div className="mt-3">
          <p className="text-xs text-[var(--muted-foreground)] mb-1 font-medium">結果</p>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--muted)]/50 border-b border-[var(--border)]">
              <span className="text-xs text-[var(--muted-foreground)]">OUTPUT</span>
              <button
                onClick={() => navigator.clipboard.writeText(
                  typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)
                )}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                複製
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-[var(--foreground)] bg-[var(--background)] overflow-x-auto">
              {typeof toolCall.result === 'string'
                ? toolCall.result
                : JSON.stringify(toolCall.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
