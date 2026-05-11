'use client';

import { useState } from 'react';
import { Code, Send, ChevronDown, ChevronRight, Copy, Check, Loader2, Play, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

// API 端点定义
interface ApiEndpoint {
  category: string;
  paths: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
    body?: object;
  }[];
}

const apiEndpoints: ApiEndpoint[] = [
  {
    category: 'SOC 分析',
    paths: [
      { method: 'POST', path: '/api/soc/analyze', description: '发起 SOC 告警分析', params: [{ name: 'alertId', type: 'string', required: false, description: '告警 ID' }, { name: 'rawContent', type: 'string', required: false, description: '原始告警内容' }, { name: 'type', type: 'string', required: false, description: '类型: simulation | live' }] },
      { method: 'GET', path: '/api/soc/sessions', description: '获取会话列表' },
      { method: 'GET', path: '/api/soc/sessions/:id', description: '获取会话详情' },
      { method: 'POST', path: '/api/soc/sessions/:id/messages', description: '发送消息', body: { content: 'string' } },
    ],
  },
  {
    category: '威胁情报',
    paths: [
      { method: 'POST', path: '/api/threat/investigate', description: '发起威胁调查', params: [{ name: 'type', type: 'string', required: true, description: '类型: ip | domain | hash' }, { name: 'value', type: 'string', required: true, description: '调查值' }, { name: 'type2', type: 'string', required: false, description: '模式: simulation | live' }] },
      { method: 'GET', path: '/api/threat/sessions', description: '获取会话列表' },
      { method: 'GET', path: '/api/threat/sessions/:id', description: '获取会话详情' },
      { method: 'POST', path: '/api/threat/sessions/:id/messages', description: '发送消息', body: { content: 'string' } },
    ],
  },
  {
    category: '渗透测试',
    paths: [
      { method: 'POST', path: '/api/pentest/assist', description: '发起渗透测试', params: [{ name: 'template', type: 'string', required: false, description: '测试模板' }, { name: 'target', type: 'string', required: true, description: '目标' }, { name: 'scope', type: 'string', required: false, description: '测试范围' }, { name: 'testType', type: 'string', required: false, description: '测试类型' }, { name: 'type', type: 'string', required: false, description: '模式: simulation | live' }] },
      { method: 'GET', path: '/api/pentest/sessions', description: '获取会话列表' },
      { method: 'GET', path: '/api/pentest/sessions/:id', description: '获取会话详情' },
      { method: 'POST', path: '/api/pentest/sessions/:id/messages', description: '发送消息', body: { content: 'string' } },
    ],
  },
  {
    category: 'BGP 路由',
    paths: [
      { method: 'GET', path: '/api/bgp/query', description: '查询 BGP 更新记录', params: [{ name: 'prefix', type: 'string', required: false, description: 'IP 前缀' }, { name: 'asn', type: 'string', required: false, description: 'ASN' }, { name: 'page', type: 'number', required: false, description: '页码' }, { name: 'limit', type: 'number', required: false, description: '每页数量' }, { name: 'start_time', type: 'string', required: false, description: '开始时间' }] },
      { method: 'GET', path: '/api/bgp/stats', description: '获取 BGP 统计' },
      { method: 'GET', path: '/api/bgp/whois/:asn', description: '查询 ASN WHOIS', params: [{ name: 'asn', type: 'string', required: true, description: 'ASN 编号' }] },
      { method: 'GET', path: '/api/bgp/lookup', description: 'IP/前缀查找', params: [{ name: 'resource', type: 'string', required: true, description: 'IP、前缀或 ASN' }] },
    ],
  },
  {
    category: 'IP 信誉',
    paths: [
      { method: 'GET', path: '/api/ip/check', description: '检查 IP 信誉', params: [{ name: 'ip', type: 'string', required: true, description: 'IP 地址' }, { name: 'forceRefresh', type: 'boolean', required: false, description: '强制刷新缓存' }] },
      { method: 'GET', path: '/api/ip/history', description: '获取 IP 检查历史' },
      { method: 'GET', path: '/api/ip/stats', description: '获取统计信息' },
      { method: 'GET', path: '/api/ip/blacklist', description: '获取黑名单', params: [{ name: 'page', type: 'number', required: false, description: '页码' }, { name: 'limit', type: 'number', required: false, description: '每页数量' }, { name: 'status', type: 'string', required: false, description: '状态过滤' }] },
      { method: 'GET', path: '/api/ip/quota', description: '获取 API 配额' },
    ],
  },
  {
    category: '报告',
    paths: [
      { method: 'GET', path: '/api/report/:sessionId/pdf', description: '生成分析报告', params: [{ name: 'sessionId', type: 'string', required: true, description: '会话 ID' }] },
    ],
  },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ToolsPage() {
  const [expandedCategory, setExpandedCategory] = useState<string>(apiEndpoints[0].category);
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ method: string; path: string; category: string } | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState<string>('');
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? '' : category);
  };

  const selectEndpoint = (endpoint: { method: string; path: string; category: string }) => {
    setSelectedEndpoint(endpoint);
    setParams({});
    setRequestBody('');
    setResponse(null);
    setError(null);
  };

  const handleParamChange = (name: string, value: string) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const buildUrl = () => {
    if (!selectedEndpoint) return '';

    let url = selectedEndpoint.path;
    const queryParams: string[] = [];

    // 替换路径参数
    for (const [key, value] of Object.entries(params)) {
      if (value && url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, value);
      } else if (value) {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    }

    if (queryParams.length > 0) {
      url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
    }

    return url;
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-[var(--terminal-green)]/20 text-[var(--terminal-green)] border-[var(--terminal-green)]/30';
      case 'POST': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'PUT': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'DELETE': return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const handleTest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const url = `${API_BASE}${buildUrl()}`;
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || `HTTP ${res.status}`);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const copycurl = () => {
    if (!selectedEndpoint) return;

    const url = `${API_BASE}${buildUrl()}`;
    let curl = `curl -X ${selectedEndpoint.method} "${url}"`;

    if (requestBody.trim()) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody}'`;
    }

    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentEndpoint = selectedEndpoint
    ? apiEndpoints.find(c => c.category === selectedEndpoint.category)
        ?.paths.find(p => p.path === selectedEndpoint.path && p.method === selectedEndpoint.method)
    : null;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header with Terminal aesthetic */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--terminal-green)]/10 border border-[var(--terminal-green)]/30">
              <Terminal className="h-4 w-4 text-[var(--terminal-green)]" />
              <span className="text-sm font-mono text-[var(--terminal-green)]">$</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">API 工具</h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-2 font-mono ml-[4.5rem]">./api-test --endpoint=list --action=test</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Endpoint List */}
        <div className="lg:col-span-1 bg-[var(--card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden group animate-fade-in-up">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--terminal-green)]">[</span>
              <h2 className="font-medium text-[var(--foreground)]">API 端点列表</h2>
              <span className="text-xs font-mono text-[var(--terminal-green)]">]</span>
            </div>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {apiEndpoints.map((category, catIndex) => (
              <div key={category.category} className="animate-fade-in-up" style={{ animationDelay: `${catIndex * 50}ms` }}>
                <button
                  onClick={() => toggleCategory(category.category)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--terminal-green)]/5 transition-colors duration-300"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">$</span>
                    <span className="font-medium text-[var(--foreground)]">{category.category}</span>
                  </div>
                  {expandedCategory === category.category ? (
                    <ChevronDown className="h-4 w-4 text-[var(--terminal-green)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                  )}
                </button>
                {expandedCategory === category.category && (
                  <div className="bg-[var(--terminal-green)]/5 py-2">
                    {category.paths.map((endpoint, epIndex) => (
                      <button
                        key={`${endpoint.method}-${endpoint.path}`}
                        onClick={() => selectEndpoint({ method: endpoint.method, path: endpoint.path, category: category.category })}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-[var(--terminal-green)]/10 transition-all duration-300 animate-fade-in-up ${
                          selectedEndpoint?.path === endpoint.path ? 'bg-[var(--terminal-green)]/10 border-l-2 border-[var(--terminal-green)]' : 'border-l-2 border-transparent'
                        }`}
                        style={{ animationDelay: `${(catIndex * 50) + (epIndex * 30)}ms` }}
                      >
                        <span className={`text-xs px-2 py-0.5 rounded font-mono border ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>
                        <span className="text-sm text-[var(--foreground)] truncate flex-1 font-mono" title={endpoint.path}>
                          {endpoint.path}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Testing */}
        <div className="lg:col-span-2 space-y-4">
          {selectedEndpoint ? (
            <>
              {/* Endpoint Info */}
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--terminal-green)]/50 transition-all duration-300 animate-fade-in-up">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className={`text-sm px-2 py-1 rounded font-mono border ${getMethodColor(selectedEndpoint.method)}`}>
                    {selectedEndpoint.method}
                  </span>
                  <span className="font-mono text-[var(--foreground)]">{selectedEndpoint.path}</span>
                  <span className="text-[var(--muted-foreground)] text-sm">// {selectedEndpoint.category}</span>
                </div>
                {currentEndpoint?.description && (
                  <p className="text-[var(--muted-foreground)] text-sm font-mono"># {currentEndpoint.description}</p>
                )}
              </div>

              {/* Parameters */}
              {currentEndpoint?.params && currentEndpoint.params.length > 0 && (
                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--terminal-green)]/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono text-[var(--terminal-green)]">&gt;</span>
                    <h3 className="font-medium text-[var(--foreground)]">请求参数</h3>
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">(params)</span>
                  </div>
                  <div className="space-y-3">
                    {currentEndpoint.params.map(param => (
                      <div key={param.name} className="grid grid-cols-4 gap-3 items-center">
                        <label className="text-sm text-[var(--foreground)] font-mono">
                          {param.name}
                          {param.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type={param.type === 'number' ? 'number' : 'text'}
                          value={params[param.name] || ''}
                          onChange={e => handleParamChange(param.name, e.target.value)}
                          placeholder={`${param.type}${param.required ? ' (必填)' : ''}`}
                          className="col-span-2 border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)]/50 focus:border-[var(--terminal-green)]/50 transition-all duration-300"
                        />
                        <span className="text-xs text-[var(--muted-foreground)] font-mono">// {param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Body */}
              {currentEndpoint?.body && (
                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 hover:border-[var(--terminal-green)]/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono text-[var(--terminal-green)]">&gt;</span>
                    <h3 className="font-medium text-[var(--foreground)]">请求体</h3>
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">(JSON body)</span>
                  </div>
                  <textarea
                    value={requestBody}
                    onChange={e => setRequestBody(e.target.value)}
                    placeholder={JSON.stringify(currentEndpoint.body, null, 2)}
                    className="w-full h-32 border border-[var(--border)] rounded-lg px-3 py-2 text-sm font-mono bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)]/50 focus:border-[var(--terminal-green)]/50 transition-all duration-300"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <Button
                  onClick={handleTest}
                  disabled={loading}
                  className="flex items-center gap-2 bg-[var(--terminal-green)]/10 border border-[var(--terminal-green)]/30 text-[var(--terminal-green)] hover:bg-[var(--terminal-green)]/20 hover:border-[var(--terminal-green)]/50 transition-all duration-300 font-mono"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>请求中...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>$ 执行</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={copycurl}
                  className="flex items-center gap-2 border-[var(--border)] text-[var(--foreground)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)] transition-all duration-300 font-mono"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Code className="h-4 w-4" />
                      <span>curl</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Response */}
              {(response || error) && (
                <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--terminal-green)]">{error ? '!' : '$'}</span>
                      <h3 className="font-medium text-[var(--foreground)]">
                        {error ? (
                          <span className="text-red-500">错误</span>
                        ) : (
                          <span className="text-[var(--terminal-green)]">响应</span>
                        )}
                      </h3>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] font-mono">
                      {response ? 'HTTP 200 OK' : ''}
                    </span>
                  </div>
                  <pre className="p-4 text-sm overflow-auto max-h-96 bg-[var(--terminal-green)]/5 font-mono">
                    {error ? (
                      <span className="text-red-500">{error}</span>
                    ) : response ? (
                      <span className="text-[var(--foreground)]">{JSON.stringify(response, null, 2)}</span>
                    ) : null}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-12 text-center hover:border-[var(--terminal-green)]/30 transition-all duration-300 animate-fade-in-up">
              <div className="inline-flex p-4 rounded-xl bg-[var(--terminal-green)]/10 mb-4">
                <Terminal className="h-12 w-12 text-[var(--terminal-green)]" />
              </div>
              <p className="text-[var(--foreground)]">选择一个 API 端点开始测试</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-2 font-mono">./select-endpoint --from=左侧列表</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 font-mono"># 填写参数后点击"$ 执行"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}