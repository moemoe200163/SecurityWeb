'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';

type EvidenceType = 'tool' | 'intelligence';

interface AddToInvestigationProps {
  executionId?: string;
  alertId?: string;
  sessionId?: string;
  data?: unknown;
  type: EvidenceType;
  onSuccess?: () => void;
  className?: string;
}

function buildTitle(type: EvidenceType, executionId?: string, alertId?: string): string {
  if (type === 'tool') {
    return executionId ? `工具執行結果 (${executionId.slice(0, 8)})` : '工具執行結果';
  }
  return alertId ? `威脅情報查詢結果 (${alertId.slice(0, 8)})` : '威脅情報查詢結果';
}

export function AddToInvestigation({
  executionId,
  alertId,
  sessionId,
  data,
  type,
  onSuccess,
  className,
}: AddToInvestigationProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDisabled = !sessionId || status === 'success' || status === 'loading';

  const handleClick = useCallback(async () => {
    if (isDisabled) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const title = buildTitle(type, executionId, alertId);
      const content = data ? JSON.stringify(data, null, 2) : title;

      await api.evidence.add(sessionId!, {
        type,
        title,
        content,
        data,
        alertId,
        toolExecutionId: type === 'tool' ? executionId : undefined,
      });

      setStatus('success');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : '新增證據失敗');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [isDisabled, sessionId, type, executionId, alertId, data, onSuccess]);

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'transition-colors',
          status === 'success' && 'border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/10',
          status === 'error' && 'border-red-600/40 text-red-400 hover:bg-red-600/10',
        )}
        aria-label={
          status === 'success'
            ? '已加入證據'
            : status === 'loading'
              ? '正在加入證據...'
              : '加入調查證據'
        }
        aria-busy={status === 'loading'}
      >
        {status === 'loading' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        )}
        {status === 'success' && (
          <Check className="h-3.5 w-3.5" />
        )}
        {(status === 'idle' || status === 'error') && (
          <Plus className="h-3.5 w-3.5" />
        )}
        <span className="text-xs font-medium">
          {status === 'loading' && '加入中...'}
          {status === 'success' && '已加入證據'}
          {status === 'error' && '失敗，請重試'}
          {status === 'idle' && '加入證據'}
        </span>
      </button>

      {errorMessage && status === 'error' && (
        <span className="text-[10px] text-red-400 leading-tight" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
