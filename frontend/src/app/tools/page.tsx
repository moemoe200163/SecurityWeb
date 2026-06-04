'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Terminal,
  List,
  History,
  Zap,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/layout/PageHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
import { AddToInvestigation } from '@/components/ui/AddToInvestigation';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api, getApiKey, ApiError, isAuthError, isForbidden } from '@/lib/api';

interface ToolTemplate {
  id: string;
  name: string;
  tool: string;
  description: string | null;
  commandTemplate: string;
  allowedParams: Record<string, string[]>;
  riskLevel: string;
  isApproved: boolean;
  isEnabled: boolean;
  createdAt: string;
}

interface ToolExecution {
  id: string;
  templateId: string;
  params: Record<string, string>;
  status: string;
  output: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  template: {
    id: string;
    name: string;
    tool: string;
    riskLevel: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Status icons
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
    case 'timeout':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

export default function ToolsPage() {
  const [view, setView] = useState<'list' | 'execute' | 'history'>('list');
  const [templates, setTemplates] = useState<ToolTemplate[]>([]);
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ToolTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; output?: string; error?: string; durationMs?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiOnline, setIsApiOnline] = useState(true);
  const [authError, setAuthError] = useState<number | false>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [apiKey, setApiKey] = useState('');
  // Surface the error in the DOM so the value is actually read.
  void error;

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tools.listTemplates();
      setTemplates((data.templates as unknown as ToolTemplate[]) || []);
      setIsApiOnline(true);
      setAuthError(false);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
        setIsApiOnline(true);
      } else if (isAuthError(err)) {
        setAuthError(401);
        setIsApiOnline(true);
      } else {
        console.error('Failed to fetch templates:', err);
        setError(err instanceof ApiError ? err.message : '無法連接到後端 API');
        setIsApiOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.tools.listExecutions({ limit: 50 });
      setExecutions((data.executions as unknown as ToolExecution[]) || []);
      setIsApiOnline(true);
      setAuthError(false);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
        setIsApiOnline(true);
      } else if (isAuthError(err)) {
        setAuthError(401);
        setIsApiOnline(true);
      } else {
        console.error('Failed to fetch executions:', err);
        setError(err instanceof ApiError ? err.message : '無法連接到後端 API');
        setIsApiOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Read apiKey from localStorage only after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    mountedRef.current = true;
    setApiKey(getApiKey());
  }, []);

  // Fetch protected data only after the stored API key has been resolved.
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!apiKey) {
      setAuthError(401);
      setLoading(false);
      return;
    }
    fetchTemplates();
    if (view === 'history') fetchExecutions();
  }, [apiKey, fetchExecutions, fetchTemplates, view]);

  const handleParamChange = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = async () => {
    if (!selectedTemplate) return;

    setExecuting(true);
    setResult(null);

    try {
      const data = await api.tools.execute({
        template_id: selectedTemplate.id,
        params,
      });
      setResult({
        success: data.success,
        output: data.output,
        error: data.error,
        durationMs: data.duration_ms,
      });

      // Store execution ID for evidence collection
      if (data.execution_id) {
        setExecutionId(data.execution_id);
      }

      // Refresh executions
      if (view === 'history') {
        await fetchExecutions();
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Unknown error'),
      });
    } finally {
      setExecuting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildCurlCommand = () => {
    if (!selectedTemplate) return '';

    const url = `${API_BASE}/api/tools/execute`;
    const body = { template_id: selectedTemplate.id, params };

    return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: $SECURITYWEB_API_KEY" \\\n  -d '${JSON.stringify(body)}'`;
  };

  const selectTemplateForExecution = (template: ToolTemplate) => {
    setSelectedTemplate(template);
    setParams({});
    setResult(null);
    setSessionId(null);
    setExecutionId(null);
    setView('execute');
  };

  // Derive required params from commandTemplate (params appearing in {param} syntax)
  const getRequiredParams = (template: ToolTemplate): Set<string> => {
    const matches = template.commandTemplate.match(/\{(\w+)\}/g) || [];
    return new Set(matches.map((m) => m.slice(1, -1)));
  };

  // Format hints for common param names
  const PARAM_HINTS: Record<string, { placeholder: string; pattern?: string; hint: string }> = {
    target: { placeholder: '192.168.1.1 或 example.com', hint: 'IP 位址或域名' },
    url: { placeholder: 'https://example.com', hint: '完整 URL（含協議）' },
    email: { placeholder: 'user@example.com', hint: '電子郵件地址' },
    service: { placeholder: 'ssh, ftp, http', hint: '服務名稱（逗號分隔）' },
    ports: { placeholder: '22,80,443 或 1-1024', hint: '連接埠（逗號分隔或範圍）' },
    host: { placeholder: '192.168.1.1', hint: '目標主機 IP 或域名' },
    domain: { placeholder: 'example.com', hint: '目標域名' },
  };

  if (authError) {
    return <ApiKeyRequired variant={authError === 403 ? 'forbidden' : 'missing'} />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PageHero
        icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="工具平台"
        subtitle="TRUSTED TOOL ORCHESTRATION"
        command="tool-manager --mode=secure"
        commandValue="execution=whitelist"
      />

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex gap-2 border-b border-[var(--border)] pb-2">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${
              view === 'list'
                ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--border)] border-b-transparent'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
            }`}
          >
            <List className="h-4 w-4" />
            <span className="font-medium">模板列表</span>
          </button>
          <button
            onClick={() => setView('execute')}
            disabled={!selectedTemplate}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${
              view === 'execute'
                ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--border)] border-b-transparent'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
            } ${!selectedTemplate ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Zap className="h-4 w-4" />
            <span className="font-medium">執行工具</span>
          </button>
          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${
              view === 'history'
                ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--border)] border-b-transparent'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
            }`}
          >
            <History className="h-4 w-4" />
            <span className="font-medium">執行歷史</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* API Key Notice */}
        {!apiKey && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">請先在 Settings 頁面設定 API Key</span>
            </div>
          </div>
        )}

        {/* API Offline Banner */}
        {!isApiOnline && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-500">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">無法連接到後端 API</span>
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {loading ? (
                <div className="text-center py-12 text-[var(--muted-foreground)]">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <span>載入中...</span>
                </div>
              ) : templates.length === 0 ? (
                <EmptyState
                  icon={<Terminal className="h-12 w-12 opacity-50" />}
                  title="尚無工具模板"
                  description="點擊上方「執行工具」或等待系統管理員新增工具模板"
                />
              ) : (
                templates.map((template) => {
                  return (
                    <div
                      key={template.id}
                      className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--terminal-green)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-[var(--foreground)]">{template.name}</h3>
                            <StatusBadge
                              variant={template.riskLevel === 'high' ? 'danger' : template.riskLevel === 'medium' ? 'warning' : 'success'}
                              dot
                            >
                              {template.riskLevel.toUpperCase()}
                            </StatusBadge>
                            {!template.isEnabled && (
                              <StatusBadge variant="muted">已停用</StatusBadge>
                            )}
                          </div>
                          <p className="text-sm text-[var(--muted-foreground)] mb-3">
                            {template.description || '無描述'}
                          </p>
                          <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted-foreground)]">
                            <Terminal className="h-3 w-3" />
                            <code className="bg-[var(--background)] px-2 py-1 rounded">
                              {template.commandTemplate}
                            </code>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => selectTemplateForExecution(template)}
                            disabled={!template.isEnabled || !apiKey}
                            className="flex items-center gap-1 bg-[var(--terminal-green)]/10 border border-[var(--terminal-green)]/30 text-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/20"
                          >
                            <Play className="h-3 w-3" />
                            執行
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Execute View */}
        {view === 'execute' && selectedTemplate && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Template Info & Params */}
            <div className="space-y-4">
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <StatusBadge
                    variant={selectedTemplate.riskLevel === 'high' ? 'danger' : selectedTemplate.riskLevel === 'medium' ? 'warning' : 'success'}
                    dot
                  >
                    {selectedTemplate.riskLevel.toUpperCase()}
                  </StatusBadge>
                  <h2 className="font-medium text-[var(--foreground)]">{selectedTemplate.name}</h2>
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                  {selectedTemplate.description || '無描述'}
                </p>
                <div className="bg-[var(--background)] rounded-lg p-3 font-mono text-sm">
                  <span className="text-[var(--terminal-green)]">$</span>
                  <span className="ml-2">{selectedTemplate.commandTemplate}</span>
                </div>
              </div>

              {/* Parameters */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
                <h3 className="font-medium text-[var(--foreground)] mb-3">參數設定</h3>
                <div className="space-y-3">
                  {Object.entries(selectedTemplate.allowedParams || {}).map(([key, values]) => {
                    const requiredParams = getRequiredParams(selectedTemplate);
                    const isRequired = requiredParams.has(key);
                    const hint = PARAM_HINTS[key];
                    return (
                      <div key={key}>
                        <label className="block text-sm text-[var(--foreground)] mb-1 font-mono">
                          {key}
                          {isRequired && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                          {values.length > 0 && (
                            <span className="text-[var(--muted-foreground)] text-xs ml-2">
                              (可選值: {values.join(', ')})
                            </span>
                          )}
                          {hint && !values.length && (
                            <span className="text-[var(--muted-foreground)] text-xs ml-2">
                              {hint.hint}
                            </span>
                          )}
                        </label>
                        {values.length > 0 ? (
                          <select
                            value={params[key] || ''}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
                          >
                            <option value="">請選擇</option>
                            {values.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={params[key] || ''}
                            onChange={(e) => handleParamChange(key, e.target.value)}
                            placeholder={hint?.placeholder || `輸入 ${key}`}
                            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execute Button */}
              <Button
                onClick={handleExecute}
                disabled={executing || !apiKey}
                className="w-full bg-[var(--terminal-green)]/10 border border-[var(--terminal-green)]/30 text-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/20"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    執行中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    執行工具
                  </>
                )}
              </Button>
            </div>

            {/* Right: Result & Curl */}
            <div className="space-y-4">
              {/* Result */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--terminal-green)]">$</span>
                  <h3 className="font-medium text-[var(--foreground)]">執行結果</h3>
                  {result?.durationMs && (
                    <span className="text-xs text-[var(--muted-foreground)] ml-auto">
                      {result.durationMs}ms
                    </span>
                  )}
                </div>
                <div className="p-4 bg-[var(--background)] max-h-96 overflow-auto">
                  {result ? (
                    result.success ? (
                      <pre className="text-sm font-mono text-[var(--foreground)] whitespace-pre-wrap">
                        {result.output || '(無輸出)'}
                      </pre>
                    ) : (
                      <div className="text-red-500 font-mono text-sm">
                        <XCircle className="h-4 w-4 inline mr-2" />
                        {result.error}
                      </div>
                    )
                  ) : (
                    <div className="text-[var(--muted-foreground)] text-sm font-mono text-center py-8">
                      填寫參數後點擊「執行工具」
                    </div>
                  )}
                </div>
              </div>

              {/* Evidence Collection */}
              {result && executionId && (
                <AddToInvestigation
                  executionId={executionId}
                  sessionId={sessionId || undefined}
                  type="tool"
                  data={{ output: result.output, templateId: selectedTemplate?.id }}
                />
              )}

              {/* Curl Command */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--terminal-green)]">$</span>
                    <h3 className="font-medium text-[var(--foreground)]">cURL 命令</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(buildCurlCommand())}
                    className="flex items-center gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        已複製
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        複製
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-4 bg-[var(--background)]">
                  <pre className="text-xs font-mono text-[var(--foreground)] whitespace-pre-wrap overflow-x-auto">
                    {buildCurlCommand()}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="space-y-4">
            {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[var(--muted-foreground)]" />
                  <span className="text-[var(--muted-foreground)]">載入中...</span>
                </div>
              ) : executions.length === 0 ? (
                <EmptyState
                  icon={<History className="h-12 w-12 opacity-50" />}
                  title="尚無執行記錄"
                  description="執行工具後記錄會顯示在這裡"
                />
            ) : (
              <div className="space-y-3">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={exec.status} />
                        <span className="font-medium text-[var(--foreground)]">
                          {exec.template.name}
                        </span>
                        <StatusBadge
                          variant={exec.template.riskLevel === 'high' ? 'danger' : exec.template.riskLevel === 'medium' ? 'warning' : 'success'}
                        >
                          {exec.template.riskLevel}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                        {exec.durationMs && (
                          <span className="font-mono">{exec.durationMs}ms</span>
                        )}
                        <span className="font-mono">
                          {new Date(exec.createdAt).toLocaleString('zh-TW')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted-foreground)]">
                      <span>參數:</span>
                      <code className="bg-[var(--background)] px-2 py-0.5 rounded">
                        {JSON.stringify(exec.params)}
                      </code>
                    </div>
                    {exec.error && (
                      <div className="mt-2 text-xs text-red-500 font-mono">
                        {exec.error}
                      </div>
                    )}
                    {exec.output && exec.status === 'success' && (
                      <details className="mt-2">
                        <summary className="text-xs text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)]">
                          查看輸出
                        </summary>
                        <pre className="mt-2 p-2 bg-[var(--background)] rounded text-xs font-mono text-[var(--foreground)] overflow-x-auto max-h-32">
                          {exec.output}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
