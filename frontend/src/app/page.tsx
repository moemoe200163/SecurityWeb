'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Search, Network, AlertTriangle, TrendingUp, Clock, Activity, Terminal } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api, ApiError, isAuthError, isForbidden, type SessionDetail } from '@/lib/api';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';
import { PageHero } from '@/components/layout/PageHero';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color: string;
}

function StatCard({ label, value, icon, trend, trendUp, color }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 group hover:border-[var(--terminal-green)]/50 transition-all duration-300">
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[var(--terminal-green)]/5 to-transparent" />

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,0,0.02)_50%)] bg-[length:100%_4px]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{label}</span>
          <div className={cn('p-2 rounded-lg', color)}>
            {icon}
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold font-mono text-[var(--foreground)]">{value}</span>
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-mono', trendUp ? 'text-green-500' : 'text-red-500')}>
              <TrendingUp className={cn('h-3 w-3', !trendUp && 'rotate-180')} />
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  status: 'completed' | 'in_progress' | 'failed';
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const recentActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'pentest',
    title: '滲透測試完成',
    description: '目標: 192.168.1.1',
    time: '5 分鐘前',
    status: 'completed',
  },
  {
    id: '2',
    type: 'threat',
    title: '威脅情報更新',
    description: 'IP 8.8.8.8 標記為良性',
    time: '15 分鐘前',
    status: 'completed',
  },
  {
    id: '3',
    type: 'soc',
    title: 'SOC 分析完成',
    description: '新攻擊鏈分析',
    time: '30 分鐘前',
    status: 'completed',
  },
  {
    id: '4',
    type: 'pentest',
    title: '漏洞掃描中',
    description: '目標: demo.testfire.net',
    time: '1 小時前',
    status: 'in_progress',
  },
  {
    id: '5',
    type: 'threat',
    title: 'BGP 路由異常',
    description: 'AS15169 路由變更',
    time: '2 小時前',
    status: 'completed',
  },
];

function ActivityFeed() {
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

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--terminal-green)]" />
          <h3 className="text-sm font-medium text-[var(--foreground)]">最近活動</h3>
        </div>
        <Link href="/soc/history" className="text-xs text-[var(--muted-foreground)] hover:text-[var(--terminal-green)] transition-colors">
          查看全部 →
        </Link>
      </div>

      {/* Activity list */}
      <div className="divide-y divide-[var(--border)]">
        {recentActivity.map((item, index) => (
          <div
            key={item.id}
            className="px-5 py-3 hover:bg-[var(--accent)] transition-colors cursor-pointer animate-fade-in-up"
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
          </div>
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
  const [stats, setStats] = useState({ totalSessions: 0, totalThreats: 0, totalPentest: 0 });
  const [authError, setAuthError] = useState<number | false>(false);
  void stats;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const sessions = await api.getAllSessions();
      setRecentSessions(sessions.slice(0, 5));
      setStats({
        totalSessions: sessions.filter(s => s.module === 'soc').length,
        totalThreats: sessions.filter(s => s.module === 'threat').length,
        totalPentest: sessions.filter(s => s.module === 'pentest').length,
      });
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
    setCurrentTime(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
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

  const activityItems: ActivityItem[] = recentSessions.slice(0, 5).map((session) => {
    const typeLabels = { soc: 'SOC 分析', threat: '威脅情報', pentest: '滲透測試' };
    const inputObj = session.input as Record<string, unknown>;
    const inputValue = inputObj.indicator as string ?? inputObj.value as string ?? inputObj.target as string ?? '';
    return {
      id: session.id,
      type: session.module as 'soc' | 'threat' | 'pentest',
      title: typeLabels[session.module as keyof typeof typeLabels] || session.module,
      description: `目標: ${inputValue.slice(0, 30) || '未知'}`,
      time: new Date(session.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      status: session.status === 'completed' ? 'completed' : 'in_progress',
    };
  });

  if (authError) {
    return <ApiKeyRequired variant={authError === 403 ? 'forbidden' : 'missing'} />;
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="總分析會話"
            value="30"
            icon={<Activity className="h-5 w-5 text-[var(--soc)]" />}
            trend="+12%"
            trendUp
            color="bg-[var(--soc)]/10"
          />
          <StatCard
            label="威脅情報"
            value="156"
            icon={<Shield className="h-5 w-5 text-[var(--threat)]" />}
            trend="+5"
            trendUp
            color="bg-[var(--threat)]/10"
          />
          <StatCard
            label="滲透測試"
            value="11"
            icon={<Network className="h-5 w-5 text-[var(--pentest)]" />}
            trend="+3"
            trendUp
            color="bg-[var(--pentest)]/10"
          />
          <StatCard
            label="系統狀態"
            value="正常"
            icon={<AlertTriangle className="h-5 w-5 text-green-500" />}
            color="bg-green-500/10"
          />
        </div>

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
                stats="30 會話"
                delay={0}
              />
              <ModuleCard
                title="威脅情報調查"
                description="IP、域名、雜湊值情報分析"
                href="/threat/investigate"
                icon={<Search className="h-6 w-6 text-[var(--threat)]" />}
                color="bg-[var(--threat)]/10"
                stats="156 記錄"
                delay={100}
              />
              <ModuleCard
                title="滲透測試輔助"
                description="自動化滲透測試工作流"
                href="/pentest/assist"
                icon={<Network className="h-6 w-6 text-[var(--pentest)]" />}
                color="bg-[var(--pentest)]/10"
                stats="11 任務"
                delay={200}
              />
            </div>

            {/* Activity Feed */}
            <ActivityFeed />
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
