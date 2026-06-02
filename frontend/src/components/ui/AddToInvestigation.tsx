'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type EvidenceType = 'tool' | 'intelligence';

interface AddToInvestigationProps {
  /** Tool execution ID (when type is 'tool') */
  executionId?: string;
  /** Alert ID (when adding alert-related evidence) */
  alertId?: string;
  /** Investigation session ID to attach evidence to */
  sessionId?: string;
  /** Arbitrary evidence payload (serialized to JSON and sent as content) */
  data?: unknown;
  /** Whether this is a tool execution result or threat intelligence query result */
  type: EvidenceType;
  /** Called after evidence is successfully added */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('api_key') || '';
}

/**
 * Builds a human-readable summary line describing the evidence being added.
 */
function buildEvidenceLabel(type: EvidenceType, executionId?: string, alertId?: string): string {
  if (type === 'tool' && executionId) {
    return `[工具執行結果] execution_id: ${executionId}`;
  }
  if (type === 'intelligence' && alertId) {
    return `[威脅情報查詢結果] alert_id: ${alertId}`;
  }
  if (type === 'tool') {
    return '[工具執行結果]';
  }
  return '[威脅情報查詢結果]';
}

/**
 * AddToInvestigation — shared button that adds tool execution results or
 * threat intelligence query results as investigation evidence to a session.
 *
 * State machine: idle -> loading -> success (terminal).
 * The button is disabled when no sessionId is provided or after a successful add.
 */
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
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('請先登入以使用此功能');
      }

      const label = buildEvidenceLabel(type, executionId, alertId);
      const content = data ? `${label}\n${JSON.stringify(data, null, 2)}` : label;

      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          type,
          executionId,
          alertId,
          content,
          data,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = (body as { error?: string }).error || `HTTP ${response.status}`;
        throw new Error(msg);
      }

      setStatus('success');
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '新增證據失敗');
      // Allow retry after a short delay
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
