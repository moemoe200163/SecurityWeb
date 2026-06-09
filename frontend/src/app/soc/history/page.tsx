'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, Network, Shield, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { api, isAuthError, isForbidden, type SessionDetail } from '@/lib/api';
import { formatRelativeTime, formatTaipeiDateTime } from '@/lib/datetime';
import { AuthNotice } from '@/components/ui/AuthNotice';
import { PageHero } from '@/components/layout/PageHero';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function InputDisplay({ input }: { input: unknown }) {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const value = obj.indicator as string ?? obj.value as string ?? obj.target as string ?? obj.alert as string ?? null;
  if (!value) return null;
  return <span className="text-[--color-threat]">{String(value)}</span>;
}

const moduleIcons: Record<string, React.ReactNode> = {
  soc: <Shield className="h-5 w-5" />,
  threat: <Search className="h-5 w-5" />,
  pentest: <Network className="h-5 w-5" />,
};

const moduleLabels: Record<string, string> = {
  soc: 'SOC 告警分析',
  threat: '威脅情報調查',
  pentest: '滲透測試輔助',
};

const moduleColors: Record<string, string> = {
  soc: 'bg-[--color-soc]/10 text-[--color-soc]',
  threat: 'bg-[--color-threat]/10 text-[--color-threat]',
  pentest: 'bg-[--color-pentest]/10 text-[--color-pentest]',
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<number | false>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const data = await api.getAllSessions();
      setSessions(data);
      setLastRefresh(new Date());
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
      } else if (isAuthError(err)) {
        setAuthError(401);
        return;
      }
      setError('載入歷史記錄失敗');
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setMounted(true);
    loadSessions();
  }, [loadSessions]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadSessions();
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadSessions]);

  return (
    <div className="h-full flex flex-col">
      <PageHero
        icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="歷史分析記錄"
        subtitle="SOC ANALYSIS RECORDS"
        command="soc-records --count"
        commandValue={`${sessions.length}`}
        actions={(
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '更新中...' : '重新整理'}
          </Button>
        )}
      />
      <div className="px-6">
        {lastRefresh && (
          <div className="max-w-4xl mx-auto py-3 text-xs font-mono text-[var(--muted-foreground)]">
            上次更新: {formatTaipeiDateTime(lastRefresh.toISOString())}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {authError !== false && <AuthNotice variant={authError === 403 ? 'forbidden' : 'missing'} mode="banner" />}

          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 border-[var(--border)] bg-[var(--card)]">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                </Card>
              ))}
            </>
          )}

          {error && (
            <Card className="p-8 text-center border-[var(--border)] bg-[var(--card)]">
              <p className="text-[var(--destructive)]">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadSessions}>
                重試
              </Button>
            </Card>
          )}

          {!loading && !error && sessions.length === 0 && (
            <Card className="p-8 text-center border-[var(--border)] bg-[var(--card)]">
              <FileText className="h-12 w-12 mx-auto text-[var(--muted-foreground)] mb-4" />
              <h3 className="font-medium text-[var(--card-foreground)] mb-2">暫無歷史記錄</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                開始一個新的分析任務後，就能在這裡看到記錄
              </p>
              <Link href="/soc/analyze">
                <Button>開始新分析</Button>
              </Link>
            </Card>
          )}

          {!loading && !error && sessions.length > 0 && (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer border-[var(--border)] bg-[var(--card)]"
                >
                  <Link
                    href={`/${session.module === 'soc' ? 'soc/analyze' : session.module === 'threat' ? 'threat/investigate' : 'pentest/assist'}?session=${session.id}`}
                    className="flex items-center gap-4"
                  >
                    {/* Icon */}
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${moduleColors[session.module] || 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}
                    >
                      {moduleIcons[session.module] || <FileText className="h-5 w-5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--card-foreground)]">
                          {moduleLabels[session.module] || session.module}
                        </h3>
                        <Badge
                          variant={session.status === 'completed' ? 'default' : 'secondary'}
                          className={
                            session.status === 'completed'
                              ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/10'
                              : ''
                          }
                        >
                          {session.status === 'completed' ? '已完成' : '進行中'}
                        </Badge>
                      </div>
                      {/* Input 值 + Session ID */}
                      <div className="flex items-center gap-2 mt-1 text-sm text-[var(--muted-foreground)] font-mono">
                        <InputDisplay input={session.input} />
                        <span className="text-[var(--muted-foreground)] text-xs">·</span>
                        <span className="text-[var(--muted-foreground)] text-xs font-mono">ID: {session.id.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-[var(--muted-foreground)]">
                        <Clock className="h-3 w-3" />
                        <span className="font-mono text-xs">{mounted ? formatTaipeiDateTime(session.createdAt) : '載入中...'}</span>
                        <span className="text-[var(--border)]">·</span>
                        <span className="text-xs">{mounted ? formatRelativeTime(session.createdAt) : ''}</span>
                        {session.steps && (
                          <>
                            <span>·</span>
                            <span>
                              {session.steps.filter((s) => s.status === 'success').length} / {session.steps.length} 步驟
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)]" />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
