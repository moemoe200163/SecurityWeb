'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ShieldAlert,
  Zap,
  RefreshCw,
  Star,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/SectionCard';

interface ProviderMeta {
  id: string;
  displayName: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  keyPreview: string | null;
}

interface HealthResult {
  status: string;
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
  message: string;
  safeError: string | null;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  auth_error: { label: 'Auth Error', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  billing_error: { label: 'Billing', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  model_error: { label: 'Model Error', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  rate_limited: { label: 'Rate Limited', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  endpoint_error: { label: 'Unreachable', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  timeout: { label: 'Timeout', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  not_configured: { label: 'Not Configured', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  unknown_error: { label: 'Error', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

const STATUS_MESSAGES: Record<string, string> = {
  auth_error: 'API Key 錯誤或已撤銷，請檢查後重新輸入。',
  billing_error: '餘額不足或 billing 問題，請確認帳戶狀態。',
  model_error: '模型不存在或帳號無權限存取此模型。',
  rate_limited: '請求過於頻繁，請稍後再試。',
  endpoint_error: 'Base URL 無法連線，請檢查網址是否正確。',
  timeout: '請求逾時，服務可能暫時不穩定。',
  not_configured: '尚未設定 API Key，請先輸入。',
};

export function LLMProviderSection() {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [active, setActive] = useState('minimax');
  const [loading, setLoading] = useState(true);
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ baseUrl: string; model: string; apiKey: string }>({ baseUrl: '', model: '', apiKey: '' });
  const [forbidden, setForbidden] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.settings.listLLMProviders();
      setProviders(data.providers);
      setActive(data.active);
    } catch (err) {
      console.error('Failed to load LLM providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const handleTest = async (providerId: string) => {
    try {
      setTestingId(providerId);
      const result = await api.settings.testLLMProvider(providerId);
      setHealthResults((prev) => ({ ...prev, [providerId]: result as unknown as HealthResult }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else if (err instanceof ApiError && err.status === 429) {
        setHealthResults((prev) => ({
          ...prev,
          [providerId]: { status: 'rate_limited', ok: false, latencyMs: 0, checkedAt: new Date().toISOString(), message: '請求過於頻繁', safeError: null },
        }));
      }
    } finally {
      setTestingId(null);
    }
  };

  const handleSelect = async (providerId: string) => {
    try {
      setSelectingId(providerId);
      await api.settings.selectLLMProvider(providerId);
      setActive(providerId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      }
    } finally {
      setSelectingId(null);
    }
  };

  const handleStartEdit = (p: ProviderMeta) => {
    setEditingId(p.id);
    setEditForm({ baseUrl: p.baseUrl, model: p.model, apiKey: '' });
  };

  const handleSaveEdit = async (providerId: string) => {
    try {
      const body: { baseUrl?: string; model?: string; apiKey?: string } = {};
      if (editForm.baseUrl) body.baseUrl = editForm.baseUrl;
      if (editForm.model) body.model = editForm.model;
      if (editForm.apiKey) body.apiKey = editForm.apiKey;
      await api.settings.updateLLMProvider(providerId, body);
      setEditingId(null);
      await fetchProviders();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      }
    }
  };

  if (loading) {
    return (
      <SectionCard title="LLM Provider Health">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="LLM Provider Health">
      <div className="space-y-3">
        {forbidden && (
          <div className="flex items-center gap-2 text-sm text-[var(--terminal-amber)] bg-[var(--terminal-amber)]/5 border border-[var(--terminal-amber)]/20 rounded-lg p-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>僅限管理員修改 LLM Provider 設定。請使用具有 admin 角色的 API Key。</span>
          </div>
        )}

        <p className="text-xs text-[var(--muted-foreground)]">
          設定用於 AI 分析的 LLM Provider。每組 Key 只存在後端，不會回傳完整值到前端。
        </p>

        {providers.map((p) => {
          const health = healthResults[p.id];
          const isActive = active === p.id;
          const isEditing = editingId === p.id;
          const badge = health ? STATUS_BADGES[health.status] : null;
          const statusMsg = health ? STATUS_MESSAGES[health.status] : null;

          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 transition-all ${
                isActive
                  ? 'border-[var(--terminal-green)]/50 bg-[var(--terminal-green)]/5'
                  : 'border-[var(--border)] bg-[var(--background)]'
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {isActive && <Star className="h-4 w-4 text-[var(--terminal-green)] shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-[var(--foreground)] truncate">{p.displayName}</div>
                    <div className="text-xs font-mono text-[var(--muted-foreground)] truncate">
                      {p.hasKey ? p.keyPreview : '[-] No key'}
                      <span className="mx-1.5">·</span>
                      {p.model}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {badge && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                  {health?.latencyMs ? (
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">{health.latencyMs}ms</span>
                  ) : null}
                </div>
              </div>

              {/* Status message */}
              {health && !health.ok && statusMsg && (
                <div className="mt-2 flex items-start gap-2 text-xs text-[var(--terminal-amber)] bg-[var(--terminal-amber)]/5 border border-[var(--terminal-amber)]/20 rounded-lg p-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="mt-3 space-y-2 pt-3 border-t border-[var(--border)]">
                  <div>
                    <label className="block text-xs font-mono text-[var(--muted-foreground)] mb-1">base-url</label>
                    <input
                      type="text"
                      value={editForm.baseUrl}
                      onChange={(e) => setEditForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--muted-foreground)] mb-1">model</label>
                    <input
                      type="text"
                      value={editForm.model}
                      onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[var(--muted-foreground)] mb-1">
                      api-key
                      {p.hasKey && <span className="ml-1 text-[var(--muted-foreground)]">(留空則保持現有 Key)</span>}
                    </label>
                    <input
                      type="password"
                      value={editForm.apiKey}
                      onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                      placeholder={p.hasKey ? '••••••••（已設定）' : 'sk-...'}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(p.id)}
                      className="bg-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/90 text-black text-xs"
                    >
                      儲存
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="text-xs"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isEditing && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(p.id)}
                    disabled={testingId === p.id || forbidden}
                    className="text-xs border-[var(--border)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
                  >
                    {testingId === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    測試
                  </Button>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSelect(p.id)}
                      disabled={selectingId === p.id || forbidden}
                      className="text-xs border-[var(--border)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
                    >
                      {selectingId === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Star className="h-3 w-3 mr-1" />
                      )}
                      使用此 Provider
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEdit(p)}
                    disabled={forbidden}
                    className="text-xs border-[var(--border)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    設定
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Refresh all */}
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchProviders}
            className="text-xs border-[var(--border)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重新整理
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
