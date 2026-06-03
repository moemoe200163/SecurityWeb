'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, RotateCw, Trash2, Copy } from 'lucide-react';
import { api, setApiKey, clearApiKey } from '@/lib/api';

interface Meta {
  prefix: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
}

export function MyApiKeyPanel() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'valid' | 'invalid' | null>(null);
  const [rotating, setRotating] = useState(false);
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    api.me.getApiKey()
      .then(setMeta)
      .catch(() => setMeta(null))
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await api.me.getApiKey();
      setTestResult('valid');
    } catch {
      setTestResult('invalid');
    } finally {
      setTesting(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await api.me.rotateApiKey();
      setNewPlaintext(result.plaintext);
      setConfirmed(false);
      setMeta({
        prefix: result.metadata.prefix,
        createdAt: result.metadata.createdAt,
        revokedAt: null,
        expiresAt: null,
      });
    } catch (err) {
      console.error('Rotate failed', err);
      alert('Failed to rotate key');
    } finally {
      setRotating(false);
    }
  };

  const handleConfirm = () => {
    if (newPlaintext && confirmed) {
      setApiKey(newPlaintext);
      closeModal();
    }
  };

  const handleClearLocal = () => {
    if (confirm('Clear local API key? The key will still work for other clients.')) {
      // setApiKey(null) — the existing clearApiKey() helper
      clearApiKey();
    }
  };

  const closeModal = useCallback(() => {
    setNewPlaintext(null);
    setConfirmed(false);
  }, []);

  useEffect(() => {
    if (!newPlaintext) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Hard block: cancel the Escape so browser doesn't close anything else either
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [newPlaintext]);

  // a11y: clipboard error feedback
  const [copyError, setCopyError] = useState<string | null>(null);

  // a11y: focus management refs
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const rotateButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleCopy = useCallback(async () => {
    if (!newPlaintext) return;
    try {
      await navigator.clipboard.writeText(newPlaintext);
      setCopyError(null);
    } catch {
      setCopyError('複製失敗，請手動選取並複製');
    }
  }, [newPlaintext]);

  // a11y: trap Tab/Shift+Tab among the three focusable elements
  const trapTabInDialog = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusable = [copyButtonRef.current, checkboxRef.current, closeButtonRef.current].filter(
      (el): el is HTMLButtonElement | HTMLInputElement => el !== null && !el.disabled,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // a11y: focus the checkbox when modal opens, return focus to Rotate button on close
  useEffect(() => {
    if (newPlaintext) {
      // Defer to next tick so the input is mounted
      const t = setTimeout(() => checkboxRef.current?.focus(), 0);
      return () => clearTimeout(t);
    } else {
      rotateButtonRef.current?.focus();
    }
  }, [newPlaintext]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="font-mono text-sm text-[var(--terminal-green)]">$ my-api-key</h3>

      {meta && (
        <div className="space-y-1 font-mono text-sm">
          <div>
            <span className="text-muted-foreground">Prefix:</span>{' '}
            <span>{meta.prefix ?? <em className="text-muted-foreground">(no key)</em>}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{' '}
            <span>{meta.createdAt ? new Date(meta.createdAt).toLocaleString() : '—'}</span>
          </div>
          {meta.revokedAt && (
            <div className="text-red-500">Revoked: {new Date(meta.revokedAt).toLocaleString()}</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-[var(--terminal-green)]/50 text-sm"
        >
          {testing ? 'Testing...' : 'Test key'}
        </button>
        <button
          ref={rotateButtonRef}
          onClick={handleRotate}
          disabled={rotating}
          className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black hover:opacity-90 text-sm flex items-center gap-1"
        >
          <RotateCw className="h-3.5 w-3.5" /> {rotating ? 'Rotating...' : 'Rotate'}
        </button>
        <button
          onClick={handleClearLocal}
          className="px-3 py-1.5 rounded border border-[var(--border)] hover:border-red-500/50 hover:text-red-500 text-sm flex items-center gap-1"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear local
        </button>
      </div>

      {testResult === 'valid' && (
        <div className="flex items-center gap-1 text-sm text-[var(--terminal-green)]">
          <CheckCircle className="h-4 w-4" /> API key is valid
        </div>
      )}
      {testResult === 'invalid' && (
        <div className="flex items-center gap-1 text-sm text-red-500">
          <XCircle className="h-4 w-4" /> API key is invalid
        </div>
      )}

      {newPlaintext && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rotate-modal-title"
          aria-describedby="rotate-modal-warning"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapTabInDialog}
            ref={dialogRef}
          >
            <h4 id="rotate-modal-title" className="font-bold text-lg">Save your new API key</h4>
            <p id="rotate-modal-warning" className="text-sm text-muted-foreground">
              This is the only time you will see this key. Copy it now and store it securely.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-black/40 font-mono text-sm break-all">
              <code className="flex-1">{newPlaintext}</code>
              <button
                ref={copyButtonRef}
                onClick={handleCopy}
                className="p-1 hover:text-[var(--terminal-green)]"
                aria-label="Copy API key"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copyError && (
              <div role="alert" className="text-xs text-red-500">
                {copyError}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                ref={checkboxRef}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                aria-label="Confirm I have saved this key"
              />
              I have saved this key
            </label>
            <div className="flex justify-end">
              <button
                ref={closeButtonRef}
                onClick={handleConfirm}
                disabled={!confirmed}
                className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50"
              >
                I&apos;ve saved — close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
