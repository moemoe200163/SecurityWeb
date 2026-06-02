'use client';

import { useEffect, useState } from 'react';
import { Shield, Search, Network, Clock, FileText, Filter, RefreshCw, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PageHero } from '@/components/layout/PageHero';

interface HistoryRecord {
  id: string;
  module: 'soc' | 'threat' | 'pentest';
  title: string;
  target: string;
  status: 'completed' | 'in_progress' | 'failed';
  steps: { completed: number; total: number };
  timestamp: string;
  timeAgo: string;
}

function HistoryCard({ record }: { record: HistoryRecord }) {
  const moduleConfig = {
    soc: {
      icon: <Shield className="h-4 w-4" />,
      color: 'bg-[var(--soc)]/10 text-[var(--soc)]',
      href: `/soc/analyze?session=${record.id}`,
    },
    threat: {
      icon: <Search className="h-4 w-4" />,
      color: 'bg-[var(--threat)]/10 text-[var(--threat)]',
      href: `/threat/investigate?session=${record.id}`,
    },
    pentest: {
      icon: <Network className="h-4 w-4" />,
      color: 'bg-[var(--pentest)]/10 text-[var(--pentest)]',
      href: `/pentest/assist?session=${record.id}`,
    },
  };

  const config = moduleConfig[record.module];
  const statusConfig = {
    completed: { label: '已完成', color: 'text-green-500', dot: 'bg-green-500' },
    in_progress: { label: '執行中', color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse' },
    failed: { label: '失敗', color: 'text-red-500', dot: 'bg-red-500' },
  };

  return (
    <Link
      href={config.href}
      className="group block rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 hover:border-[var(--terminal-green)]/50 hover:bg-[var(--terminal-green)]/5 transition-all duration-300 animate-fade-in-up"
    >
      <div className="flex items-start gap-4">
        {/* Module icon */}
        <div className={cn('p-3 rounded-xl', config.color)}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--terminal-green)] transition-colors">
              {record.title}
            </h3>
            <div className={cn('flex items-center gap-1.5', statusConfig[record.status].color)}>
              <div className={cn('w-2 h-2 rounded-full', statusConfig[record.status].dot)} />
              <span className="text-xs font-medium">{statusConfig[record.status].label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] mb-2">
            <span className="font-mono truncate">{record.target}</span>
            <span>·</span>
            <span className="font-mono text-xs">ID: {record.id.slice(0, 8)}</span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[var(--accent)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--terminal-green)] to-[var(--terminal-amber)] transition-all duration-500"
                style={{ width: `${(record.steps.completed / record.steps.total) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-[var(--muted-foreground)] whitespace-nowrap">
              {record.steps.completed} / {record.steps.total} 步驟
            </span>
          </div>
        </div>

        {/* Time and arrow */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{record.timeAgo}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--terminal-green)] group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
}

function FilterBar({
  selectedModule,
  selectedStatus,
  onModuleChange,
  onStatusChange,
  onReset,
  moduleCounts,
}: {
  selectedModule: 'all' | 'soc' | 'threat' | 'pentest';
  selectedStatus: 'all' | 'completed' | 'in_progress' | 'failed';
  onModuleChange: (m: 'all' | 'soc' | 'threat' | 'pentest') => void;
  onStatusChange: (s: 'all' | 'completed' | 'in_progress' | 'failed') => void;
  onReset: () => void;
  moduleCounts: Record<string, number>;
}) {
  const modules = [
    { key: 'all', label: '全部', count: Object.values(moduleCounts).reduce((a, b) => a + b, 0) },
    { key: 'soc', label: 'SOC 分析', count: moduleCounts.soc || 0 },
    { key: 'threat', label: '威脅情報', count: moduleCounts.threat || 0 },
    { key: 'pentest', label: '滲透測試', count: moduleCounts.pentest || 0 },
  ];

  const statuses = [
    { key: 'all', label: '全部狀態' },
    { key: 'completed', label: '已完成' },
    { key: 'in_progress', label: '執行中' },
    { key: 'failed', label: '失敗' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Module filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[var(--muted-foreground)]" />
        <span className="text-sm font-medium text-[var(--muted-foreground)]">模組:</span>
        <div className="flex gap-1">
          {modules.map((m) => (
            <button
              key={m.key}
              onClick={() => onModuleChange(m.key as typeof selectedModule)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                selectedModule === m.key
                  ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--terminal-green)]/30'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--terminal-green)]/10'
              )}
            >
              {m.label} ({m.count})
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">狀態:</span>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s.key}
              onClick={() => onStatusChange(s.key as typeof selectedStatus)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                selectedStatus === s.key
                  ? 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)] border border-[var(--terminal-green)]/30'
                  : 'bg-[var(--accent)] text-[var(--muted-foreground)] hover:bg-[var(--terminal-green)]/10'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {(selectedModule !== 'all' || selectedStatus !== 'all') && (
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-all ml-auto"
        >
          <X className="h-3 w-3" />
          清空篩選
        </button>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<'all' | 'soc' | 'threat' | 'pentest'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'in_progress' | 'failed'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    // Simulated data - in production would fetch from API
    const mockRecords: HistoryRecord[] = [
      { id: 'b07c92ab-69fe-423c-b52f-e1bed6580223', module: 'pentest', title: '滲透測試輔助', target: '192.168.1.1', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-11T07:00:00Z', timeAgo: '5 小時前' },
      { id: '621985e8-675d-412d-b80f-30a97adfff65', module: 'threat', title: '威脅情報調查', target: '8.8.8.8', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-11T06:45:00Z', timeAgo: '5 小時前' },
      { id: '322ef100-f745-4d0b-a8a3-4e9d0c2712df', module: 'soc', title: 'SOC 告警分析', target: '攻擊鏈分析', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-11T06:30:00Z', timeAgo: '5 小時前' },
      { id: '57911fb4-aa4b-4020-bb23-bbc6b9840a03', module: 'pentest', title: '滲透測試輔助', target: '192.168.20.199', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-11T05:00:00Z', timeAgo: '7 小時前' },
      { id: 'c92174fb-a3df-4346-aab9-729765035c2c', module: 'pentest', title: '滲透測試輔助', target: '192.168.20.199', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-11T04:00:00Z', timeAgo: '8 小時前' },
      { id: 'ab3e1e66-4b0b-4190-94e6-4bcc6ba02e3b', module: 'pentest', title: '滲透測試輔助', target: 'https://demo.testfire.net', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-10T22:00:00Z', timeAgo: '14 小時前' },
      { id: '21f7440e-5030-47f6-af21-4fd2ec3c27b5', module: 'pentest', title: '滲透測試輔助', target: '192.168.20.199', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-10T20:00:00Z', timeAgo: '16 小時前' },
      { id: '661f9b71-57aa-4c8a-a673-5ef232107d94', module: 'soc', title: 'SOC 告警分析', target: 'CRLF注入攻擊', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-10T18:00:00Z', timeAgo: '18 小時前' },
      { id: '2d1c4edf-7dfa-4764-a369-0c25dd277dc1', module: 'threat', title: '威脅情報調查', target: '8.8.8.8', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-09T12:00:00Z', timeAgo: '1 天前' },
      { id: 'a498e339-1f4d-4d08-8549-5670ed4abec4', module: 'threat', title: '威脅情報調查', target: '1.1.1.1', status: 'completed', steps: { completed: 5, total: 5 }, timestamp: '2026-05-09T10:00:00Z', timeAgo: '2 天前' },
    ];
    setRecords(mockRecords);
    setLoading(false);
  }, [lastRefresh]);

  const moduleCounts = records.reduce((acc, r) => {
    acc[r.module] = (acc[r.module] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredRecords = records.filter((r) => {
    if (selectedModule !== 'all' && r.module !== selectedModule) return false;
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="h-full overflow-auto bg-[var(--background)]">
      <PageHero
        icon={<FileText className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="分析歷史記錄"
        subtitle="HISTORY RECORDS"
        command="records --count"
        commandValue={`${filteredRecords.length}`}
        actions={(
          <button
            onClick={() => setLastRefresh(new Date())}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--terminal-green)]/50 hover:bg-[var(--terminal-green)]/10 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">重新整理</span>
          </button>
        )}
      />

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Filters */}
        <FilterBar
          selectedModule={selectedModule}
          selectedStatus={selectedStatus}
          onModuleChange={setSelectedModule}
          onStatusChange={setSelectedStatus}
          onReset={() => {
            setSelectedModule('all');
            setSelectedStatus('all');
          }}
          moduleCounts={moduleCounts}
        />

        {/* Records list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--terminal-green)] border-t-transparent" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-dashed border-[var(--border)]">
            <FileText className="h-12 w-12 text-[var(--muted-foreground)]/50 mx-auto mb-4" />
            <p className="text-[var(--muted-foreground)]">沒有符合條件的記錄</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record, index) => (
              <div key={record.id} style={{ animationDelay: `${index * 30}ms` }}>
                <HistoryCard record={record} />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted-foreground)]">
            <span>最後更新:</span>
            <span className="text-[var(--terminal-green)]">
              {lastRefresh?.toLocaleTimeString('zh-TW') || '--:--:--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
