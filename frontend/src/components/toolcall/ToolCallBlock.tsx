'use client';

import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        toolCall.status === 'calling' && 'border-blue-300 bg-blue-50',
        toolCall.status === 'success' && 'border-green-300 bg-green-50',
        toolCall.status === 'error' && 'border-red-300 bg-red-50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusIcon[toolCall.status]}
          <span className="font-mono text-sm font-medium">
            {toolCall.toolName}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {toolCall.status === 'calling' && '調用中...'}
          {toolCall.status === 'success' && '成功'}
          {toolCall.status === 'error' && '失敗'}
        </span>
      </div>

      {toolCall.params && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">參數:</p>
          <pre className="bg-white/50 p-2 rounded text-xs font-mono overflow-x-auto">
            {JSON.stringify(toolCall.params, null, 2)}
          </pre>
        </div>
      )}

      {toolCall.result != null && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">結果:</p>
          <pre className="bg-white/50 p-2 rounded text-xs font-mono overflow-x-auto">
            {typeof toolCall.result === 'string'
              ? toolCall.result
              : JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
