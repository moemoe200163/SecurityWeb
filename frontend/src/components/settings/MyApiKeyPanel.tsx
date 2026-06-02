'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCw, Trash2, Eye, EyeOff, Copy } from 'lucide-react';
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
      setNewPlaintext(null);
      setConfirmed(false);
    }
  };

  const handleClearLocal = () => {
    if (confirm('Clear local API key? The key will still work for other clients.')) {
      // setApiKey(null) — the existing clearApiKey() helper
      clearApiKey();
    }
  };

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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4">
            <h4 className="font-bold text-lg">Save your new API key</h4>
            <p className="text-sm text-muted-foreground">
              This is the only time you will see this key. Copy it now and store it securely.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-black/40 font-mono text-sm break-all">
              <code className="flex-1">{newPlaintext}</code>
              <button
                onClick={() => navigator.clipboard.writeText(newPlaintext)}
                className="p-1 hover:text-[var(--terminal-green)]"
                aria-label="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I have saved this key
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setNewPlaintext(null)}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!confirmed}
                className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50"
              >
                Activate new key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
