'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, pollSession, type SessionDetail, type IpReputationResult } from '@/lib/api';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
import { Loader2, Search, AlertCircle, CheckCircle2, XCircle, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, Terminal } from 'lucide-react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/layout/PageHero';
import { AddToInvestigation } from '@/components/ui/AddToInvestigation';

function ThreatInvestigateContent() {
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('session');
  const [indicator, setIndicator] = useState('');
  const [type, setType] = useState<'ip' | 'domain' | 'hash'>('ip');
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
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
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        return;
      }
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
      if (err instanceof ApiError && err.status === 401) {
        setAuthError(true);
        return;
      }
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
        return <CheckCircle2 className="h-4 w-4 text-[var(--terminal-green)]" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-[var(--color-soc)] animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-[var(--color-threat)]" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-[var(--border)]" />;
    }
  };

  const completedSteps = session?.steps?.filter(s => s.status === 'success').length || 0;
  const totalSteps = session?.steps?.length || 5;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // IP Reputation Card
  const getReputationIcon = (status: string) => {
    switch (status) {
      case 'malicious':
        return <ShieldAlert className="h-8 w-8 text-[var(--color-threat)]" />;
      case 'suspicious':
        return <Shield className="h-8 w-8 text-[var(--terminal-amber)]" />;
      case 'normal':
        return <ShieldCheck className="h-8 w-8 text-[var(--terminal-green)]" />;
      default:
        return <ShieldQuestion className="h-8 w-8 text-[var(--muted-foreground)]" />;
    }
  };

  const getReputationBgColor = (status: string) => {
    switch (status) {
      case 'malicious':
        return 'bg-[var(--color-threat)]/10 border-[var(--color-threat)]/30';
      case 'suspicious':
        return 'bg-[var(--terminal-amber)]/10 border-[var(--terminal-amber)]/30';
      case 'normal':
        return 'bg-[var(--terminal-green)]/10 border-[var(--terminal-green)]/30';
      default:
        return 'bg-[var(--muted)]/50 border-[var(--border)]';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'malicious':
        return <span className="px-3 py-1 bg-[var(--color-threat)] text-white text-sm font-medium rounded-full">MALICIOUS</span>;
      case 'suspicious':
        return <span className="px-3 py-1 bg-[var(--terminal-amber)] text-white text-sm font-medium rounded-full">SUSPICIOUS</span>;
      case 'normal':
        return <span className="px-3 py-1 bg-[var(--terminal-green)] text-white text-sm font-medium rounded-full">SAFE</span>;
      default:
        return <span className="px-3 py-1 bg-[var(--muted-foreground)] text-white text-sm font-medium rounded-full">UNKNOWN</span>;
    }
  };

  if (authError) {
    return <ApiKeyRequired />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PageHero
        icon={<Terminal className="h-8 w-8 text-[var(--color-threat)]" />}
        title="威脅情報調查"
        subtitle="THREAT INTELLIGENCE INVESTIGATION"
        command="threat-investigate --indicator-type"
        commandValue={type}
        accentClassName="text-[var(--color-threat)] bg-[var(--color-threat)]/10"
      />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Command Input Section */}
        <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6 hover:border-[var(--terminal-green)]/50 transition-all duration-300 animate-fade-in-up">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[var(--terminal-green)]/5 to-transparent" />
          {/* Corner decorations */}
          <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
            <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
          </div>

          <div className="flex gap-4 items-center relative">
            {/* $ Command prefix */}
            <div className="flex items-center gap-2 text-[var(--terminal-green)] font-mono text-lg">
              <span>$</span>
              <span className="text-[var(--muted-foreground)]">/investigate</span>
            </div>

            <select
              value={type}
              onChange={e => setType(e.target.value as typeof type)}
              className="border border-[var(--border)] rounded-lg px-4 py-2 text-[var(--foreground)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono"
            >
              <option value="ip">--type ip</option>
              <option value="domain">--type domain</option>
              <option value="hash">--type hash</option>
            </select>
            <input
              type="text"
              value={indicator}
              onChange={e => setIndicator(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={type === 'ip' ? '1.1.1.1' : type === 'domain' ? 'example.com' : '44f4b6e2...'}
              className="flex-1 border border-[var(--border)] rounded-lg px-4 py-2 text-[var(--foreground)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono placeholder:text-[var(--muted-foreground)]"
            />
            <button
              onClick={handleInvestigate}
              disabled={loading || !indicator.trim()}
              className="bg-[var(--color-threat)] text-white px-6 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-mono transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>ANALYZING...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>EXECUTE</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* IP Reputation Result */}
        {(ipLoading || ipReputation) && type === 'ip' && (
          <div className={cn(
            'rounded-xl border p-6 mb-6 animate-fade-in-up',
            ipReputation ? getReputationBgColor(ipReputation.status) : 'bg-[var(--muted)]/50 border-[var(--border)]'
          )}>
            {ipLoading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-soc)]" />
                <span className="text-[var(--foreground)] font-mono">{'>'} Querying IP reputation database...</span>
              </div>
            ) : ipReputation ? (
              <div className="flex items-start gap-4">
                {getReputationIcon(ipReputation.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-lg font-semibold text-[var(--foreground)]">{ipReputation.ip}</span>
                    {getStatusBadge(ipReputation.status)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    {ipReputation.countryName && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">COUNTRY</p>
                        <p className="text-sm font-medium text-[var(--foreground)]">{ipReputation.countryName}</p>
                      </div>
                    )}
                    {ipReputation.isp && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">ISP</p>
                        <p className="text-sm font-medium text-[var(--foreground)]">{ipReputation.isp}</p>
                      </div>
                    )}
                    {ipReputation.confidenceScore !== null && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">CONFIDENCE</p>
                        <p className="text-sm font-medium text-[var(--foreground)] font-mono">{ipReputation.confidenceScore}%</p>
                      </div>
                    )}
                    {ipReputation.totalReports !== undefined && (
                      <div>
                        <p className="text-xs text-[var(--muted-foreground)] font-mono">REPORTS</p>
                        <p className="text-sm font-medium text-[var(--foreground)] font-mono">{ipReputation.totalReports}</p>
                      </div>
                    )}
                  </div>
                  {ipReputation.sources && ipReputation.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--muted-foreground)] mb-2 font-mono">SOURCES</p>
                      <div className="flex gap-2">
                        {ipReputation.sources.map((source, i) => (
                          <span key={i} className="px-2 py-1 bg-[var(--card)] rounded text-xs font-medium text-[var(--foreground)] font-mono">
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
          <div className="bg-[var(--color-threat)]/10 border border-[var(--color-threat)]/30 rounded-xl p-4 mb-6 flex items-start gap-3 animate-fade-in-up">
            <AlertCircle className="h-5 w-5 text-[var(--color-threat)] mt-0.5" />
            <div>
              <p className="font-medium text-[var(--color-threat)] font-mono">ERROR</p>
              <p className="text-[var(--foreground)] text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {(loading || session) && (
          <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 mb-6 hover:border-[var(--terminal-green)]/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-[var(--terminal-green)]/5 to-transparent" />
            {/* Corner decorations */}
            <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
              <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
            </div>

            <div className="flex items-center justify-between mb-4 relative">
              <div className="flex items-center gap-2">
                {session?.status === 'completed' || session?.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--terminal-green)]" />
                ) : loading ? (
                  <Loader2 className="h-5 w-5 text-[var(--color-soc)] animate-spin" />
                ) : null}
                <span className="font-medium text-[var(--foreground)] font-mono">
                  {session?.status === 'completed' || session?.status === 'success'
                    ? '[COMPLETED]'
                    : loading
                    ? '[ANALYZING...]'
                    : '[PENDING]'}
                </span>
              </div>
              <span className="text-sm text-[var(--muted-foreground)] font-mono">
                {completedSteps} / {totalSteps} STEPS
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  session?.status === 'completed' || session?.status === 'success' ? 'bg-[var(--terminal-green)]' : 'bg-[var(--color-soc)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Steps */}
            {session?.steps && session.steps.length > 0 && (
              <div className="mt-6 space-y-3">
                {session.steps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-3" style={{ animationDelay: `${(index + 1) * 100}ms` }}>
                    {getStatusIcon(step.status)}
                    <div className="flex-1">
                      <p className={cn(
                        'text-sm font-mono',
                        step.status === 'success' ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                      )}>
                        <span className="text-[var(--terminal-green)]">[{step.status === 'success' ? 'OK' : step.status === 'running' ? 'RUN' : 'PND'}]</span>
                        {' '}{step.title}
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
          <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
              <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
            </div>
            <div className="border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-[var(--terminal-green)] font-mono">$</span>
                <h2 className="font-medium text-[var(--foreground)]">分析結果</h2>
              </div>
            </div>
            <div className="p-6">
              {session.steps
                .filter(s => s.content && s.status === 'success')
                .map((step, index) => (
                  <div key={step.id} className="mb-6" style={{ animationDelay: `${(index + 3) * 100}ms` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-[var(--terminal-green)]">[OUTPUT]</span>
                      <h3 className="font-medium text-[var(--foreground)]">{step.title}</h3>
                    </div>
                    {step.content && (
                      <MarkdownRenderer content={step.content} />
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Evidence Collection */}
        {session && sessionIdFromUrl && (
          <AddToInvestigation
            sessionId={sessionIdFromUrl}
            type="intelligence"
            data={{ query: indicator, type, result: session }}
          />
        )}

        {/* Empty State */}
        {!session && !loading && !error && (
          <div className="text-center py-12 text-[var(--muted-foreground)] animate-fade-in-up">
            <div className="inline-flex p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] mb-4">
              <Terminal className="h-12 w-12 text-[var(--muted-foreground)]" />
            </div>
            <p className="font-mono text-lg mb-2">{'>'} Awaiting input...</p>
            <p className="text-sm text-[var(--muted-foreground)]">支援 IP、域名和檔案雜湊</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThreatInvestigatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono">Loading...</div>}>
      <ThreatInvestigateContent />
    </Suspense>
  );
}
