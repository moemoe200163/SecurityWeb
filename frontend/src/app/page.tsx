'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Search, Network, AlertTriangle, Clock, Activity, Terminal, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api, isAuthError, isForbidden, type SessionDetail } from '@/lib/api';
import { AuthNotice } from '@/components/ui/AuthNotice';
import { formatTaipeiDateTime, formatRelativeTime } from '@/lib/datetime';
import { type SessionStatus } from '@/lib/status';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/layout/PageHero';
import { AnalysisCard } from '@/components/dashboard/AnalysisCard';
import { EMPTY_ANALYSIS_METRICS, AnalysisAuthNotice } from '@/components/dashboard/AnalysisAuthNotice';
import type { AnalysisMetrics } from '@/lib/types/dashboard';

interface ModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  stats: string;
  delay: number;
}

function ModuleCard({ title, description, href, icon, color, stats, delay }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 hover:border-[var(--terminal-green)]/50 transition-all duration-500 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[var(--terminal-green)]/10 via-transparent to-transparent" />

      {/* Corner decoration */}
      <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-l from-[var(--terminal-green)]/30 to-transparent" />
        <div className="absolute top-0 right-0 h-[1px] w-8 bg-gradient-to-b from-[var(--terminal-green)]/30 to-transparent" />
      </div>

      {/* Status indicator */}
      <div className="absolute top-4 left-4">
        <div className={cn('w-2 h-2 rounded-full animate-pulse', color)} />
      </div>

      <div className="relative z-10 pt-4">
        <div className={cn('inline-flex p-3 rounded-xl mb-4', color)}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-1 group-hover:text-[var(--terminal-green)] transition-colors">
          {title}
        </h3>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">{description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[var(--muted-foreground)]">{stats}</span>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--terminal-green)] opacity-0 group-hover:opacity-100 transition-opacity">
            進入
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface ActivityItem {
  id: string;
  type: 'soc' | 'threat' | 'pentest';
  title: string;
  description: string;
  time: string;
  status: SessionStatus;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const MODULE_LABELS: Record<string, string> = {
  soc: 'SOC 告警分析',
  threat: '威脅情報調查',
  pentest: '滲透測試輔助',
};

// Build a deep link into the right workspace for an activity item.
// Mirrors the routing used in /history so the two surfaces agree.
function activityHrefFor(item: ActivityItem): string {
  switch (item.type) {
    case 'soc':
      return `/soc/analyze?session=${encodeURIComponent(item.id)}`;
    case 'threat':
      return `/threat/investigate?session=${encodeURIComponent(item.id)}`;
    case 'pentest':
      return `/pentest/assist?session=${encodeURIComponent(item.id)}`;
    default:
      return '/history';
  }
}

function sessionToActivity(session: SessionDetail): ActivityItem {
  const input = session.input as Record<string, unknown> | undefined;
  const target =
    (input?.indicator as string) ||
    (input?.value as string) ||
    (input?.target as string) ||
    (input?.url as string) ||
    (input?.endpoint as string) ||
    (input?.alertTitle as string) ||
    '';

  let status: SessionStatus = 'in_progress';
  if (session.status === 'completed') status = 'completed';
  else if (session.status === 'failed') status = 'failed';

  return {
    id: session.id,
    type: session.module as ActivityItem['type'],
    title: MODULE_LABELS[session.module] || session.module,
    description: target || `Session ${session.id.slice(0, 8)}`,
    time: formatRelativeTime(session.createdAt),
    status,
  };
}

function ActivityFeed({ sessions }: { sessions: SessionDetail[] }) {
  const typeColors = {
    soc: 'text-[var(--soc)] bg-[var(--soc)]/10',
    threat: 'text-[var(--threat)] bg-[var(--threat)]/10',
    pentest: 'text-[var(--pentest)] bg-[var(--pentest)]/10',
  };

  const statusIcons = {
    completed: <div className="w-2 h-2 rounded-full bg-green-500" />,
    in_progress: <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />,
    failed: <div className="w-2 h-2 rounded-full bg-red-500" />,
  };

  const items = sessions.map(sessionToActivity);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--terminal-green)]" />
          <h3 className="text-sm font-medium text-[var(--foreground)]">最近活動</h3>
        </div>
        <Link href="/history" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--terminal-green)] transition-colors">
          查看全部 →
        </Link>
      </div>

      {/* Activity list */}
      <div className="divide-y divide-[var(--border)]">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[var(--muted-foreground)]">
            暫無活動記錄
          </div>
        ) : items.map((item, index) => (
          // 4-o fix: cursor-pointer was visual-only (no onClick) which
          // tricked users into expecting a navigation. Wrap in <Link>
          // and route to the same workspace the History page uses.
          <Link
            key={item.id}
            href={activityHrefFor(item)}
            className="block px-5 py-3 hover:bg-[var(--accent)] transition-colors animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-1 p-1.5 rounded-md', typeColors[item.type])}>
                {item.type === 'soc' && <Shield className="h-3 w-3" />}
                {item.type === 'threat' && <Search className="h-3 w-3" />}
                {item.type === 'pentest' && <Network className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">{item.title}</span>
                  {statusIcons[item.status]}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate">{item.description}</p>
              </div>
              <span className="text-xs text-[var(--muted-foreground)] font-mono whitespace-nowrap">{item.time}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SystemStatus() {
  const services = [
    { name: 'Frontend', status: 'online', color: 'bg-green-500' },
    { name: 'Backend API', status: 'online', color: 'bg-green-500' },
    { name: 'Database', status: 'online', color: 'bg-green-500' },
    { name: 'BGP Consumer', status: 'idle', color: 'bg-yellow-500' },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="h-4 w-4 text-[var(--terminal-green)]" />
        <h3 className="text-sm font-medium text-[var(--foreground)]">系統狀態</h3>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--muted-foreground)]">{service.name}</span>
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', service.color, service.status === 'idle' && 'animate-pulse')} />
              <span className="text-xs font-mono text-[var(--foreground)]">{service.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Decorative terminal lines */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="font-mono text-xs text-[var(--muted-foreground)] space-y-1">
          <div><span className="text-[var(--terminal-green)]">$</span> system status --all</div>
          <div><span className="text-[var(--terminal-green)]">$</span> all services operational</div>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: '上傳告警', href: '/soc/analyze', icon: <Shield className="h-4 w-4" /> },
    { label: '查詢 IP', href: '/threat/investigate', icon: <Search className="h-4 w-4" /> },
    { label: '新建滲透測試', href: '/pentest/assist', icon: <Network className="h-4 w-4" /> },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-[var(--terminal-green)]" />
        <h3 className="text-sm font-medium text-[var(--foreground)]">快速開始</h3>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {actions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] hover:border-[var(--terminal-green)]/50 hover:bg-[var(--terminal-green)]/5 transition-all duration-200 group animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="p-2 rounded-lg bg-[var(--accent)] group-hover:bg-[var(--terminal-green)]/10 transition-colors">
              {action.icon}
            </div>
            <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--terminal-green)] transition-colors">
              {action.label}
            </span>
            <svg className="w-4 h-4 ml-auto text-[var(--muted-foreground)] group-hover:text-[var(--terminal-green)] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ThreatAlertBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--terminal-amber)]/30 bg-[var(--terminal-amber)]/5 p-4 animate-fade-in-up">
      {/* Animated border glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 border border-[var(--terminal-amber)]/20 rounded-xl" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--terminal-amber)] to-transparent animate-pulse" />
      </div>

      <div className="relative flex items-center gap-4">
        <div className="p-3 rounded-xl bg-[var(--terminal-amber)]/10">
          <AlertTriangle className="h-6 w-6 text-[var(--terminal-amber)]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-[var(--foreground)]">注意：系統監控中</h4>
          <p className="text-xs text-[var(--muted-foreground)]">BGP 路由監控已啟動，等待新威脅情報...</p>
        </div>
        <Link
          href="/threat/bgp"
          className="px-4 py-2 rounded-lg bg-[var(--terminal-amber)]/10 text-xs font-medium text-[var(--terminal-amber)] hover:bg-[var(--terminal-amber)]/20 transition-colors"
        >
          查看詳情
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [recentSessions, setRecentSessions] = useState<SessionDetail[]>([]);
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const [authError, setAuthError] = useState<number | false>(false);
  const [analysisData, setAnalysisData] = useState<AnalysisMetrics | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisAuthNotice, setAnalysisAuthNotice] = useState<'missing' | 'forbidden' | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const sessions = await api.getAllSessions();
      setRecentSessions(sessions.slice(0, 5));
      const counts: Record<string, number> = {};
      for (const s of sessions) {
        counts[s.module] = (counts[s.module] || 0) + 1;
      }
      setModuleCounts(counts);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
      } else if (isAuthError(err)) {
        setAuthError(401);
      } else {
        console.error('Failed to load activity:', err);
      }
    }
  }, []);

  useEffect(() => {
    setCurrentTime(formatTaipeiDateTime(new Date().toISOString()));
    const interval = setInterval(() => {
      setCurrentTime(formatTaipeiDateTime(new Date().toISOString()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial activity and set up auto-refresh
  useEffect(() => {
    loadActivity();
    intervalRef.current = setInterval(loadActivity, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadActivity]);

  // Load analysis metrics from dashboard stats (non-blocking)
  useEffect(() => {
    const loadStats = async () => {
      try {
        setAnalysisLoading(true);
        const data = await api.dashboard.stats();
        if (data.metrics.analysis) {
          setAnalysisData(data.metrics.analysis);
        }
      } catch (err) {
        if (isForbidden(err)) {
          setAnalysisAuthNotice('forbidden');
          setAnalysisData(EMPTY_ANALYSIS_METRICS);
        } else if (isAuthError(err)) {
          setAnalysisAuthNotice('missing');
          setAnalysisData(EMPTY_ANALYSIS_METRICS);
        } else {
          setAnalysisError('Failed to load dashboard metrics');
        }
      } finally {
        setAnalysisLoading(false);
      }
    };
    loadStats();
  }, []);

  if (authError) {
    return <AuthNotice variant={authError === 403 ? 'forbidden' : 'missing'} mode="blocking" />;
  }

  return (
    <div className="h-full overflow-auto bg-[var(--background)]">
      <PageHero
        icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="安全智能體"
        subtitle="TACTICAL OPERATIONS CENTER"
        commandValue={currentTime}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Threat Alert Banner */}
        <ThreatAlertBanner />

        {/* Analysis auth notice (non-blocking) */}
        {analysisAuthNotice && <AnalysisAuthNotice variant={analysisAuthNotice} />}

        {/* Stats Row */}
        {analysisLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16 mb-3" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : analysisData ? (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AnalysisCard
              label="本月事故"
              value={analysisData.month.current.incidents}
              icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
              accentColor="bg-red-500/10"
              mom={analysisData.comparison.monthOverMonth.incidents}
              yoy={analysisData.comparison.yearOverYear.incidents}
              invertTrend
              href="/alerts"
            />
            <AnalysisCard
              label="成功解除"
              value={analysisData.month.current.successfulResolutions}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              accentColor="bg-emerald-500/10"
              mom={analysisData.comparison.monthOverMonth.successfulResolutions}
              yoy={analysisData.comparison.yearOverYear.successfulResolutions}
              href="/alerts?status=resolved"
            />
            <AnalysisCard
              label="失敗解除"
              value={analysisData.month.current.failedResolutions}
              icon={<XCircle className="h-5 w-5 text-orange-400" />}
              accentColor="bg-orange-500/10"
              mom={analysisData.comparison.monthOverMonth.failedResolutions}
              yoy={analysisData.comparison.yearOverYear.failedResolutions}
              invertTrend
              href="/alerts?status=failed_resolution"
            />
            <AnalysisCard
              label="解除率"
              value={analysisData.month.current.resolutionRate}
              icon={<BarChart3 className="h-5 w-5 text-blue-400" />}
              accentColor="bg-blue-500/10"
              mom={analysisData.comparison.monthOverMonth.resolutionRate}
              yoy={analysisData.comparison.yearOverYear.resolutionRate}
              valueSuffix="%"
              href="/analysis"
            />
          </div>
          <div className="flex justify-center">
            <Link
              href="/analysis"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--terminal-green)] hover:border-[var(--terminal-green)]/50 transition-colors"
            >
              查看完整分析
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          </>
        ) : analysisError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-center">
            <p className="text-sm text-red-400 mb-3">{analysisError}</p>
            <button
              onClick={() => {
                setAnalysisError(null);
                setAnalysisLoading(true);
                api.dashboard.stats()
                  .then((data) => {
                    if (data.metrics.analysis) setAnalysisData(data.metrics.analysis);
                  })
                  .catch((err) => {
                    if (isForbidden(err)) {
                      setAnalysisAuthNotice('forbidden');
                      setAnalysisData(EMPTY_ANALYSIS_METRICS);
                    } else if (isAuthError(err)) {
                      setAnalysisAuthNotice('missing');
                      setAnalysisData(EMPTY_ANALYSIS_METRICS);
                    } else {
                      setAnalysisError('Failed to load dashboard metrics');
                    }
                  })
                  .finally(() => setAnalysisLoading(false));
              }}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              重試
            </button>
          </div>
        ) : null}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Module Cards - 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--terminal-green)]/50 to-transparent" />
              <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">模組入口</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ModuleCard
                title="SOC 告警分析"
                description="安全事件智能分析與響應系統"
                href="/soc/analyze"
                icon={<Shield className="h-6 w-6 text-[var(--soc)]" />}
                color="bg-[var(--soc)]/10"
                stats={`${moduleCounts.soc || 0} 會話`}
                delay={0}
              />
              <ModuleCard
                title="威脅情報調查"
                description="IP、域名、雜湊值情報分析"
                href="/threat/investigate"
                icon={<Search className="h-6 w-6 text-[var(--threat)]" />}
                color="bg-[var(--threat)]/10"
                stats={`${moduleCounts.threat || 0} 記錄`}
                delay={100}
              />
              <ModuleCard
                title="滲透測試輔助"
                description="自動化滲透測試工作流"
                href="/pentest/assist"
                icon={<Network className="h-6 w-6 text-[var(--pentest)]" />}
                color="bg-[var(--pentest)]/10"
                stats={`${moduleCounts.pentest || 0} 任務`}
                delay={200}
              />
            </div>

            {/* Activity Feed */}
            <ActivityFeed sessions={recentSessions} />
          </div>

          {/* Right Sidebar - 1/3 width */}
          <div className="space-y-4">
            <SystemStatus />
            <QuickActions />
          </div>
        </div>

        {/* Footer decoration */}
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-4 font-mono text-xs text-[var(--muted-foreground)]">
            <span>SecurityWeb v1.0</span>
            <span>|</span>
            <span className="text-[var(--terminal-green)]">●</span>
            <span>所有系統運行正常</span>
          </div>
        </div>
      </div>
    </div>
  );
}
