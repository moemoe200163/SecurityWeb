'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCw, X, Copy } from 'lucide-react';
import { api } from '@/lib/api';

interface KeyRow {
  prefix: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  user: { id: string; email: string; role: string };
}

export function UserKeyTable() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [plaintextFor, setPlaintextFor] = useState<{ userId: string; plaintext: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const closeModal = useCallback(() => {
    setPlaintextFor(null);
    setConfirmed(false);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.adminKeys.list();
      setKeys(res.keys);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!plaintextFor) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [plaintextFor, closeModal]);

  const handleRotate = async (userId: string) => {
    if (!confirm(`Rotate this user's API key? Their current key will be invalidated.`)) return;
    setRotatingId(userId);
    try {
      const res = await api.adminKeys.rotate(userId);
      setPlaintextFor({ userId, plaintext: res.plaintext });
      await load();
    } catch (err) {
      console.error('Rotate failed', err);
      alert('Failed to rotate key');
    } finally {
      setRotatingId(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!confirm(`Revoke this user's API key? This cannot be undone.`)) return;
    try {
      await api.adminKeys.revoke(userId);
      await load();
    } catch (err) {
      console.error('Revoke failed', err);
      alert('Failed to revoke key');
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading keys...</div>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--card)] font-mono text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-2">User</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Prefix</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Created</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const status = k.revokedAt ? 'revoked' : k.prefix ? 'active' : 'no-key';
              return (
                <tr key={k.user.id} className="border-t border-[var(--border)]">
                  <td className="p-2 font-mono text-xs">{k.user.email}</td>
                  <td className="p-2">{k.user.role}</td>
                  <td className="p-2 font-mono text-xs">{k.prefix ?? '—'}</td>
                  <td className="p-2">
                    <span className={
                      status === 'active' ? 'text-[var(--terminal-green)]' :
                      status === 'revoked' ? 'text-red-500' : 'text-muted-foreground'
                    }>
                      {status}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-2 text-right space-x-1">
                    <button
                      onClick={() => handleRotate(k.user.id)}
                      disabled={rotatingId === k.user.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--terminal-green)]/50 text-xs"
                    >
                      <RotateCw className="h-3 w-3" /> Rotate
                    </button>
                    {status !== 'revoked' && (
                      <button
                        onClick={() => handleRevoke(k.user.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--border)] hover:border-red-500/50 hover:text-red-500 text-xs"
                      >
                        <X className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plaintextFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-rotate-modal-title"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        >
          <div
            className="bg-[var(--card)] rounded-xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="admin-rotate-modal-title" className="font-bold text-lg">New key generated</h4>
            <p className="text-sm text-muted-foreground">
              Copy this key and deliver it to the user. It will not be shown again.
            </p>
            <div className="flex items-center gap-2 p-2 rounded bg-black/40 font-mono text-sm break-all">
              <code className="flex-1">{plaintextFor.plaintext}</code>
              <button
                onClick={() => navigator.clipboard.writeText(plaintextFor.plaintext)}
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
                aria-label="Confirm key delivered to user"
              />
              I have delivered this key to the user
            </label>
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                disabled={!confirmed}
                className="px-3 py-1.5 rounded bg-[var(--terminal-green)] text-black text-sm disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
