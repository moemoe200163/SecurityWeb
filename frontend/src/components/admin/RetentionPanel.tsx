'use client';

import { useState, useEffect } from 'react';
import { Play, Eye, AlertCircle, ShieldAlert, RefreshCw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { AuthNotice } from '@/components/ui/AuthNotice';
import Link from 'next/link';

interface Status {
  counts: { auditLog: number; toolExecution: number; bgpUpdate: number };
  lastRunAt: string | null;
  lastResult: { auditLogsDeleted: number; toolExecutionsTrimmed: number; bgpUpdatesDeleted: number } | null;
  policy: { auditLogDays: number; toolExecutionDays: number; bgpUpdateDays: number };
}

interface Preview {
  auditLogsWouldDelete: number;
  toolExecutionsWouldTrim: number;
  bgpUpdatesWouldDelete: number;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; type: 'auth' | 'forbidden' | 'server'; message: string };

function classifyError(e: unknown): { type: 'auth' | 'forbidden' | 'server'; message: string } {
  if (e instanceof ApiError) {
    if (e.status === 401) return { type: 'auth', message: '需要 API Key 才能繼續' };
    if (e.status === 403) return { type: 'forbidden', message: '需要管理員權限' };
    return { type: 'server', message: e.message };
  }
  return { type: 'server', message: '網路錯誤，請稍後重試' };
}

export function RetentionPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = async () => {
    setLoadState({ kind: 'loading' });
    try {
      setStatus(await api.adminRetention.status());
      setLoadState({ kind: 'ready' });
    } catch (e) {
      setLoadState({ kind: 'error', ...classifyError(e) });
    }
  };

  useEffect(() => { load(); }, []);

  const handleDryRun = async (): Promise<typeof preview> => {
    try {
      const res = await api.adminRetention.run(true);
      if (res.mode === 'dry-run') {
        setPreview(res.preview);
        return res.preview;
      }
      return null;
    } catch (e) {
      const { message } = classifyError(e);
      setToast({ kind: 'err', msg: message });
      return null;
    }
  };

  const handleRunClick = async () => {
    // 若沒有 preview，先跑 dry-run 並直接拿到結果（避免 React 還沒 re-render 時讀到 stale closure）
    const currentPreview = preview ?? (await handleDryRun());
    if (currentPreview) {
      setShowConfirm(true);
    }
  };

  const handleConfirmRun = async () => {
    setShowConfirm(false);
    setRunning(true);
    try {
      const res = await api.adminRetention.run(false);
      if (res.mode === 'execute') {
        setToast({
          kind: 'ok',
          msg: `Deleted ${res.result.auditLogsDeleted} audit logs, trimmed ${res.result.toolExecutionsTrimmed} tool outputs, deleted ${res.result.bgpUpdatesDeleted} BGP updates.`,
        });
        setPreview(null);
        await load();
      }
    } catch (e) {
      const { message } = classifyError(e);
      setToast({ kind: 'err', msg: message });
    } finally {
      setRunning(false);
    }
  };

  if (loadState.kind === 'loading') {
    return <div className="text-sm text-muted-foreground">Loading retention status...</div>;
  }

  if (loadState.kind === 'error' && loadState.type === 'auth') {
    return <AuthNotice mode="blocking" />;
  }

  if (loadState.kind === 'error') {
    return (
      <div
        role="alert"
        className="rounded-xl border border-[var(--terminal-amber)]/30 bg-[var(--terminal-amber)]/5 p-6 space-y-3"
      >
        <div className="flex items-center gap-2 text-[var(--terminal-amber)]">
          {loadState.type === 'forbidden' ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <h3 className="font-mono text-sm">
            {loadState.type === 'forbidden' ? '需要管理員權限' : '無法載入 retention 狀態'}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">{loadState.message}</p>
        <div className="flex gap-2">
          {loadState.type === 'forbidden' ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--terminal-green)]/50 text-sm"
            >
              前往設定
            </Link>
          ) : (
            <button
              onClick={load}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black hover:opacity-90 text-sm"
            >
              <RefreshCw className="h-4 w-4" /> 重試
            </button>
          )}
        </div>
      </div>
    );
  }

  // loadState.kind === 'ready' but status may still be null on first render
  if (!status) return null;

  return (
    <div className="space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <header>
        <h2 className="text-xl font-mono text-[var(--terminal-green)]">Retention</h2>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Current counts</h3>
        <dl className="grid grid-cols-3 gap-4 font-mono text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">audit_log</dt>
            <dd className="text-lg">{status.counts.auditLog.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">tool_execution</dt>
            <dd className="text-lg">{status.counts.toolExecution.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">bgp_update</dt>
            <dd className="text-lg">{status.counts.bgpUpdate.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Policy (defaults)</h3>
        <dl className="grid grid-cols-3 gap-4 font-mono text-sm">
          <div><dt className="text-xs text-muted-foreground">audit_log</dt><dd>{status.policy.auditLogDays} days</dd></div>
          <div><dt className="text-xs text-muted-foreground">tool_execution</dt><dd>{status.policy.toolExecutionDays} days</dd></div>
          <div><dt className="text-xs text-muted-foreground">bgp_update</dt><dd>{status.policy.bgpUpdateDays} days</dd></div>
        </dl>
      </section>

      <section className="space-y-1 font-mono text-sm">
        <h3 className="text-sm font-medium text-muted-foreground">Last run</h3>
        {status.lastRunAt ? (
          <div>
            <div>{new Date(status.lastRunAt).toLocaleString()}</div>
            {status.lastResult && (
              <div className="text-xs text-muted-foreground">
                audit deleted: {status.lastResult.auditLogsDeleted} · tool trimmed: {status.lastResult.toolExecutionsTrimmed} · bgp deleted: {status.lastResult.bgpUpdatesDeleted}
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">never</div>
        )}
      </section>

      <div className="flex gap-2">
        <button
          onClick={handleDryRun}
          disabled={running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--terminal-green)]/50 text-sm"
        >
          <Eye className="h-4 w-4" /> Dry run
        </button>
        <button
          onClick={handleRunClick}
          disabled={running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black hover:opacity-90 text-sm disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> {running ? 'Running...' : 'Run now'}
        </button>
      </div>

      {showConfirm && preview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4">
            <h4 className="font-bold text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[var(--terminal-amber)]" />
              Confirm retention run
            </h4>
            <p className="text-sm text-muted-foreground">This will:</p>
            <ul className="font-mono text-sm space-y-1">
              <li>Delete {preview.auditLogsWouldDelete} audit_log rows</li>
              <li>Trim {preview.toolExecutionsWouldTrim} tool_execution outputs</li>
              <li>Delete {preview.bgpUpdatesWouldDelete} bgp_update rows</li>
            </ul>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-3 py-1.5 rounded border border-[var(--border)] text-sm">Cancel</button>
              <button onClick={handleConfirmRun} disabled={running} className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50">
                {running ? 'Running...' : 'Run for real'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 p-3 rounded text-sm ${toast.kind === 'ok' ? 'bg-[var(--terminal-green)]/20 text-[var(--terminal-green)]' : 'bg-red-500/20 text-red-500'}`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-3 text-xs">×</button>
        </div>
      )}
    </div>
  );
}
