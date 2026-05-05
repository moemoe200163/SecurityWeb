'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, Network, Shield, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { api, type SessionDetail } from '@/lib/api';

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
  soc: 'bg-red-100 text-red-700',
  threat: 'bg-blue-100 text-blue-700',
  pentest: 'bg-purple-100 text-purple-700',
};

function formatDate(dateString: string): string {
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

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAllSessions();
      setSessions(data);
    } catch (err) {
      setError('載入歷史記錄失敗');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">歷史分析記錄</h1>
            <p className="text-sm text-gray-500 mt-1">
              共 {sessions.length} 筆記錄
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions}>
            重新整理
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4">
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
            <Card className="p-8 text-center">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadSessions}>
                重試
              </Button>
            </Card>
          )}

          {!loading && !error && sessions.length === 0 && (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">暫無歷史記錄</h3>
              <p className="text-sm text-gray-500 mb-4">
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
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <Link
                    href={`/${session.module === 'soc' ? 'soc/analyze' : session.module === 'threat' ? 'threat/investigate' : 'pentest/assist'}?session=${session.id}`}
                    className="flex items-center gap-4"
                  >
                    {/* Icon */}
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${moduleColors[session.module] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {moduleIcons[session.module] || <FileText className="h-5 w-5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {moduleLabels[session.module] || session.module}
                        </h3>
                        <Badge
                          variant={session.status === 'completed' ? 'default' : 'secondary'}
                          className={
                            session.status === 'completed'
                              ? 'bg-green-100 text-green-700 hover:bg-green-100'
                              : ''
                          }
                        >
                          {session.status === 'completed' ? '已完成' : '進行中'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(session.createdAt)}</span>
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
                    <ChevronRight className="h-5 w-5 text-gray-400" />
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
