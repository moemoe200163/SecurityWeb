'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  AlertCircle,
  Zap,
  History,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Share2,
  RefreshCw,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SessionSummary {
  id: string;
  module: string;
  status: string;
  createdAt: string;
  title: string;
}

interface AnalysisSidebarProps {
  sessionId?: string;
  session?: SessionSummary;
  currentModule?: string;
  onQuickAction?: (action: string) => void;
  onToolUse?: (tool: string) => void;
}

const quickActions = [
  { id: 'copy-report', label: '複製報告', icon: <Copy className="h-4 w-4" /> },
  { id: 'download-report', label: '下載報告', icon: <Download className="h-4 w-4" /> },
  { id: 'share-report', label: '分享連結', icon: <Share2 className="h-4 w-4" /> },
  { id: 'refresh-data', label: '刷新數據', icon: <RefreshCw className="h-4 w-4" /> },
];

const recentSessions: SessionSummary[] = [
  {
    id: '1',
    module: 'soc',
    status: 'completed',
    createdAt: '2026-05-05T10:30:00Z',
    title: 'SSH 暴力破解攻擊',
  },
  {
    id: '2',
    module: 'threat',
    status: 'in_progress',
    createdAt: '2026-05-05T09:15:00Z',
    title: '惡意 IP 調查',
  },
];

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

export function AnalysisSidebar({
  sessionId,
  session,
  currentModule = 'soc',
  onQuickAction,
  onToolUse,
}: AnalysisSidebarProps) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<'info' | 'actions' | 'tools' | 'history'>('info');

  type TabId = 'info' | 'actions' | 'history';

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: '告警資訊', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'actions', label: '快速處置', icon: <Zap className="h-4 w-4" /> },
    { id: 'history', label: '歷史', icon: <History className="h-4 w-4" /> },
  ];

  return (
    <div className="w-72 border-r border-[var(--border)] bg-[var(--muted)]/30 flex flex-col h-full">
      {/* Module tabs */}
      <div className="border-b bg-[var(--card)]">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2',
                activeSection === tab.id
                  ? 'border-[--color-soc] text-[--color-soc] bg-[--color-soc]/5'
                  : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--muted)]'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Alert Info Section */}
          {activeSection === 'info' && (
            <div className="space-y-4">
              <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[var(--card-foreground)]">告警概覽</h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      session?.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : session?.status === 'in_progress'
                        ? 'bg-[--color-soc]/10 text-[--color-soc] border-[--color-soc]/20'
                        : 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]'
                    )}
                  >
                    {session?.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {session?.status === 'in_progress' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                    {session?.status === 'completed' ? '已完成' : session?.status === 'in_progress' ? '分析中' : '待處理'}
                  </Badge>
                </div>

                {session && (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--muted-foreground)]">工作階段</span>
                        <span className="font-mono text-xs text-[var(--card-foreground)]">{session.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted-foreground)]">模組</span>
                        <span className="text-[var(--card-foreground)] capitalize">{session.module}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--muted-foreground)]">創建時間</span>
                        <span className="text-[var(--card-foreground)]">{formatTimeAgo(session.createdAt)}</span>
                      </div>
                    </div>
                  </>
                )}

                {!session && (
                  <div className="text-sm text-[var(--muted-foreground)] text-center py-4">
                    暂无活跃工作階段
                  </div>
                )}
              </div>

              {/* Alert stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'IOC', value: '12', color: 'text-amber-500' },
                  { label: 'TTP', value: '5', color: 'text-red-500' },
                  { label: '風險', value: '高', color: 'text-red-500' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-3 text-center">
                    <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Session ID */}
              {sessionId && (
                <div className="bg-[var(--card)] rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">Session ID</span>
                    <button
                      className="text-xs text-[--color-soc] hover:text-[--color-soc]/80 transition-colors"
                      onClick={() => navigator.clipboard.writeText(sessionId)}
                      title="複製"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="font-mono text-xs text-[var(--card-foreground)] mt-1 truncate">{sessionId}</div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions Section */}
          {activeSection === 'actions' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                快速處置動作
              </div>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => onQuickAction?.(action.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] transition-all',
                      'hover:border-[--color-soc]/30 hover:bg-[--color-soc]/5 hover:shadow-sm'
                    )}
                  >
                    <div className="h-8 w-8 rounded-lg bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
                      {action.icon}
                    </div>
                    <span className="text-sm font-medium text-[var(--card-foreground)]">{action.label}</span>
                    <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] ml-auto" />
                  </button>
                ))}
              </div>

              {/* Emergency actions */}
              <div className="pt-4">
                <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                  緊急處置
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  終止工作階段
                </Button>
              </div>
            </div>
          )}

          {/* History Section */}
          {activeSection === 'history' && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                最近工作階段
              </div>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/soc/analyze?session=${s.id}`}
                    className={cn(
                      'block p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] transition-all',
                      'hover:border-[--color-soc]/30 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center',
                        s.module === 'soc' ? 'bg-[--color-soc]/10 text-[--color-soc]' :
                        s.module === 'threat' ? 'bg-[--color-threat]/10 text-[--color-threat]' :
                        'bg-purple-500/10 text-purple-500'
                      )}>
                        <Shield className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--card-foreground)] truncate">
                          {s.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[var(--muted-foreground)]">{formatTimeAgo(s.createdAt)}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              s.status === 'completed' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                              s.status === 'in_progress' && 'bg-[--color-soc]/10 text-[--color-soc] border-[--color-soc]/20'
                            )}
                          >
                            {s.status === 'completed' ? '已完成' : '進行中'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <Link
                href="/soc/history"
                className="flex items-center justify-center gap-2 py-3 text-sm text-[--color-soc] hover:text-[--color-soc]/80 transition-colors"
              >
                查看全部歷史
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
