'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, pollSession, type SessionDetail, type IpReputationResult } from '@/lib/api';
import { Loader2, Search, AlertCircle, CheckCircle2, XCircle, Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

function ThreatInvestigateContent() {
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');
  const [indicator, setIndicator] = useState('');
  const [type, setType] = useState<'ip' | 'domain' | 'hash'>('ip');
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ipReputation, setIpReputation] = useState<IpReputationResult | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const pollCleanupRef = useRef<(() => void) | null>(null);
  const loadedRef = useRef(false);

  // Load session from URL on mount
  useEffect(() => {
    if (sessionIdFromUrl && !loadedRef.current) {
      loadedRef.current = true;
      loadSession(sessionIdFromUrl);
    }
  }, [sessionIdFromUrl]);

  // Load session by ID
  const loadSession = async (id: string) => {
    try {
      setLoading(true);
      const { session: sess } = await api.threat.getSession(id);
      setSession(sess);
      // Set indicator from input if available
      if (sess.input && typeof sess.input === 'object') {
        const inp = sess.input as Record<string, unknown>;
        const val = inp.indicator as string ?? inp.value as string ?? null;
        if (val) setIndicator(val);
        const it = inp.indicatorType as string ?? null;
        if (it === 'domain') setType('domain');
        else if (it === 'hash') setType('hash');
        else setType('ip');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('載入セッション失敗');
    } finally {
      setLoading(false);
    }
  };

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      pollCleanupRef.current?.();
    };
  }, []);

  const handleInvestigate = async () => {
    if (!indicator.trim()) return;

    setLoading(true);
    setError(null);
    setSession(null);
    setIpReputation(null);

    // Clear any existing polling
    if (pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }

    // Check IP reputation if type is IP
    if (type === 'ip') {
      setIpLoading(true);
      try {
        const rep = await api.ip.check(indicator.trim());
        setIpReputation(rep);
      } catch (err: unknown) {
        // Check for rate limit error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('API使用上限') || errorMessage.includes('429')) {
          setError('API 使用上限，請聯絡管理員');
        } else {
          console.error('IP reputation check failed:', err);
        }
      } finally {
        setIpLoading(false);
      }
    }

    try {
      const response = await api.threat.investigate({
        type,
        value: indicator.trim(),
        type2: 'live',
      });

      // Start polling for updates
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'threat',
        (updatedSession) => {
          setSession(updatedSession);
          if (updatedSession.status === 'completed') {
            setLoading(false);
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleInvestigate();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const completedSteps = session?.steps?.filter(s => s.status === 'success').length || 0;
  const totalSteps = session?.steps?.length || 5;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // IP Reputation Card
  const getReputationIcon = (status: string) => {
    switch (status) {
      case 'malicious':
        return <ShieldAlert className="h-8 w-8 text-red-500" />;
      case 'suspicious':
        return <Shield className="h-8 w-8 text-yellow-500" />;
      case 'normal':
        return <ShieldCheck className="h-8 w-8 text-emerald-500" />;
      default:
        return <ShieldQuestion className="h-8 w-8 text-gray-400" />;
    }
  };

  const getReputationColor = (status: string) => {
    switch (status) {
      case 'malicious':
        return 'bg-red-50 border-red-200';
      case 'suspicious':
        return 'bg-yellow-50 border-yellow-200';
      case 'normal':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusBadge = (status: string, _threatLevel: string) => {
    switch (status) {
      case 'malicious':
        return <span className="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-full">❌ 惡意 IP</span>;
      case 'suspicious':
        return <span className="px-3 py-1 bg-yellow-500 text-white text-sm font-medium rounded-full">⚠️ 需調查</span>;
      case 'normal':
        return <span className="px-3 py-1 bg-emerald-500 text-white text-sm font-medium rounded-full">✅ 良性 IP</span>;
      default:
        return <span className="px-3 py-1 bg-gray-500 text-white text-sm font-medium rounded-full">❓ 未知</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">威脅情報調查</h1>
          <p className="text-sm text-gray-500 mt-1">輸入 IP、域名或雜湊值進行威脅情報分析</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Input Section */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex gap-4">
            <select
              value={type}
              onChange={e => setType(e.target.value as typeof type)}
              className="border rounded-lg px-4 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ip">IP 地址</option>
              <option value="domain">域名</option>
              <option value="hash">檔案雜湊</option>
            </select>
            <input
              type="text"
              value={indicator}
              onChange={e => setIndicator(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={type === 'ip' ? '例如：1.1.1.1' : type === 'domain' ? '例如：example.com' : '例如：44f4b6e2...'}
              className="flex-1 border rounded-lg px-4 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleInvestigate}
              disabled={loading || !indicator.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  分析中
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  調查
                </>
              )}
            </button>
          </div>
        </div>

        {/* IP Reputation Result */}
        {(ipLoading || ipReputation) && type === 'ip' && (
          <div className={`rounded-lg border p-6 mb-6 ${ipReputation ? getReputationColor(ipReputation.status) : 'bg-gray-50 border-gray-200'}`}>
            {ipLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-gray-600">正在查詢 IP 信譽資料庫...</span>
              </div>
            ) : ipReputation ? (
              <div className="flex items-start gap-4">
                {getReputationIcon(ipReputation.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-lg font-semibold text-gray-900">{ipReputation.ip}</span>
                    {getStatusBadge(ipReputation.status, ipReputation.threatLevel)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {ipReputation.countryName && (
                      <div>
                        <p className="text-xs text-gray-500">國家</p>
                        <p className="text-sm font-medium text-gray-700">{ipReputation.countryName}</p>
                      </div>
                    )}
                    {ipReputation.isp && (
                      <div>
                        <p className="text-xs text-gray-500">ISP</p>
                        <p className="text-sm font-medium text-gray-700">{ipReputation.isp}</p>
                      </div>
                    )}
                    {ipReputation.confidenceScore !== null && (
                      <div>
                        <p className="text-xs text-gray-500">信心分數</p>
                        <p className="text-sm font-medium text-gray-700">{ipReputation.confidenceScore}%</p>
                      </div>
                    )}
                    {ipReputation.totalReports !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">舉報次數</p>
                        <p className="text-sm font-medium text-gray-700">{ipReputation.totalReports}</p>
                      </div>
                    )}
                  </div>
                  {ipReputation.sources && ipReputation.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">資料來源</p>
                      <div className="flex gap-2">
                        {ipReputation.sources.map((source, i) => (
                          <span key={i} className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-600">
                            {source.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">發生錯誤</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {(loading || session) && (
          <div className="bg-white rounded-lg border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {session?.status === 'completed' || session?.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : loading ? (
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                ) : null}
                <span className="font-medium text-gray-700">
                  {session?.status === 'completed' || session?.status === 'success' ? '分析完成' : loading ? '分析中...' : '等待分析'}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {completedSteps} / {totalSteps} 步驟
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  session?.status === 'completed' || session?.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Steps */}
            {session?.steps && session.steps.length > 0 && (
              <div className="mt-6 space-y-3">
                {session.steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3">
                    {getStatusIcon(step.status)}
                    <div className="flex-1">
                      <p className={`text-sm ${step.status === 'success' ? 'text-gray-700' : 'text-gray-500'}`}>
                        {index + 1}. {step.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results Section - show step content */}
        {session?.steps && session.steps.length > 0 && (
          <div className="bg-white rounded-lg border">
            <div className="border-b px-6 py-4">
              <h2 className="font-medium text-gray-700">分析結果</h2>
            </div>
            <div className="p-6">
              {session.steps
                .filter(s => s.content && s.status === 'success')
                .map(step => (
                  <div key={step.id} className="mb-6">
                    <h3 className="font-medium text-gray-800 mb-2">{step.title}</h3>
                    {step.content && (
                      <MarkdownRenderer content={step.content} />
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!session && !loading && !error && (
          <div className="text-center py-12 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>輸入威脅指標開始調查</p>
            <p className="text-sm mt-2">支援 IP、域名和檔案雜湊</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThreatInvestigatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">載入中...</div>}>
      <ThreatInvestigateContent />
    </Suspense>
  );
}