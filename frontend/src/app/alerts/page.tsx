'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  Upload,
  Loader2,
  Search,
  Eye,
  MessageSquare,
  Shield,
  FileText,
  X,
  Send,
  Copy,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/layout/PageHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthNotice } from '@/components/ui/AuthNotice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api, isAuthError, isForbidden } from '@/lib/api';
import { formatTaipeiDateTime, formatRelativeTime } from '@/lib/datetime';
import { ALERT_STATUS } from '@/lib/status';

interface Alert {
  id: string;
  source: string;
  title: string;
  severity: string;
  rawContent: string;
  normalizedFields: Record<string, unknown> | null;
  aiVerdict: string | null;
  humanVerdict: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportToolExecution {
  tool: string;
  toolType: string;
  riskLevel: string;
  status: string;
  durationMs: number | null;
  output: string | null;
  error: string | null;
  executedAt: string;
}

interface ReportData {
  alert?: {
    title?: string;
    severity?: string;
    status?: string;
    source?: string;
    createdAt?: string;
  };
  aiAnalysis?: {
    verdict?: string | null;
  };
  toolExecutionSummary?: {
    total: number;
    executions?: ReportToolExecution[];
  };
  recommendations?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
void API_BASE;

function AlertsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    source: searchParams.get('source') || '',
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    correct_verdict: '',
    error_reason: '',
    lesson: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isApiOnline, setIsApiOnline] = useState(true);
  const [authError, setAuthError] = useState<number | false>(false);

  // Sync filters to URL for deep linking
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.source) params.set('source', filters.source);
    if (searchQuery) params.set('search', searchQuery);
    const qs = params.toString();
    router.replace(`/alerts${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [filters, searchQuery, router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.alerts.list({
        status: filters.status || undefined,
        severity: filters.severity || undefined,
        source: filters.source || undefined,
      });
      setAlerts((data.alerts as unknown as Alert[]) || []);
      setIsApiOnline(true);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
      } else if (isAuthError(err)) {
        setAuthError(401);
      } else {
        console.error('Failed to fetch alerts:', err);
        setIsApiOnline(false);
      }
    } finally {
      setLoading(false);
    }
  }, [filters.severity, filters.source, filters.status]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string, newStatus: string) => {
    try {
      await api.alerts.updateStatus(alertId, { status: newStatus });
      await fetchAlerts();
      setSelectedAlert(null);
    } catch (err) {
      console.error('Failed to update alert:', err);
    }
  };

  const handleInvestigate = async (alertId: string) => {
    try {
      const result = await api.alerts.investigate(alertId, 'soc');
      await fetchAlerts();
      setSelectedAlert(null);
      router.push(`/investigations/${result.session_id}`);
    } catch (err) {
      console.error('Failed to start investigation:', err);
    }
  };

  const filteredAlerts = useMemo(() => alerts.filter(alert => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      alert.title.toLowerCase().includes(query) ||
      alert.source.toLowerCase().includes(query) ||
      (alert.aiVerdict?.toLowerCase().includes(query)) ||
      (alert.humanVerdict?.toLowerCase().includes(query))
    );
  }), [alerts, searchQuery]);

  const formatRawContent = (rawContent: string): string => {
    try {
      return JSON.stringify(JSON.parse(rawContent || '{}'), null, 2);
    } catch {
      return rawContent || '{}';
    }
  };

  const formatDateTime = (value?: string): string => {
    if (!value) return '-';
    return formatTaipeiDateTime(value);
  };

  if (authError) {
    return <AuthNotice variant={authError === 403 ? 'forbidden' : 'missing'} mode="blocking" />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <PageHero
        icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
        title="告警中心"
        subtitle="ALERT INVESTIGATION CENTER"
        command="alert-center --mode"
        commandValue="investigation"
        accentClassName="text-red-500 bg-red-500/10"
      />

      <div className="max-w-6xl mx-auto p-6">
        {/* Search & Filters */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="搜尋告警..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-16 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] rounded px-1.5 py-0.5 pointer-events-none">
                ⌘K
              </kbd>
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--foreground)]"
          >
            <option value="">所有狀態</option>
            <option value="new">新進</option>
            <option value="investigating">調查中</option>
            <option value="resolved">已處理</option>
            <option value="failed_resolution">解除失敗</option>
            <option value="ignored">已忽略</option>
            <option value="false_positive">誤報</option>
          </select>
          <select
            value={filters.severity}
            onChange={(e) => setFilters(f => ({ ...f, severity: e.target.value }))}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--foreground)]"
          >
            <option value="">所有等級</option>
            <option value="critical">嚴重</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
            <option value="info">資訊</option>
          </select>
          <Button
            onClick={fetchAlerts}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            刷新
          </Button>
          {(searchQuery || filters.status || filters.severity) && (
            <Button
              onClick={() => {
                setSearchQuery('');
                setFilters({ status: '', severity: '', source: '' });
              }}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1 text-[var(--muted-foreground)]"
            >
              <X className="h-3 w-3" />
              清空篩選
            </Button>
          )}
        </div>

        {/* API Offline Banner */}
        {!isApiOnline && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-red-500">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">無法連接到後端 API</span>
            </div>
          </div>
        )}

        {/* Alert Import Section */}
        <div className="mb-6 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)] mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            匯入告警
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">
            支援 JSON 格式，可一次性匯入多筆告警
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={async () => {
              // Demo: import a sample alert via the shared protected client.
              await api.alerts
                .importOne({
                  source: 'import',
                  title: '測試告警 - SQL 注入',
                  severity: 'high',
                  raw_content: JSON.stringify({ timestamp: new Date().toISOString(), type: 'sqli_test' }),
                  ai_verdict: 'attack_attempt',
                })
                .then(() => fetchAlerts())
                .catch((err) => console.error('Failed to import demo alert:', err));
            }}
          >
            匯入測試資料
          </Button>
        </div>

        {/* Alert List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: List */}
          <div className="space-y-3">
            <h2 className="font-medium text-[var(--foreground)]">
              告警列表 ({filteredAlerts.length})
            </h2>
            {loading ? (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <span>載入中...</span>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-12 w-12 opacity-50" />}
                title="尚無告警記錄"
                description="匯入測試資料或等待系統產生告警"
              />
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`bg-[var(--card)] rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--terminal-green)]/50 ${
                      isSelected ? 'border-[var(--terminal-green)]/50' : 'border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : alert.severity === 'low' ? 'info' : 'muted'}
                          dot
                        >
                          {alert.severity.toUpperCase()}
                        </StatusBadge>
                        <StatusBadge
                          variant={alert.status === 'new' ? 'info' : alert.status === 'investigating' ? 'warning' : alert.status === 'resolved' ? 'success' : alert.status === 'failed_resolution' ? 'danger' : 'muted'}
                        >
                          {ALERT_STATUS[alert.status as keyof typeof ALERT_STATUS]?.label || alert.status}
                        </StatusBadge>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] font-mono">
                        {formatTaipeiDateTime(alert.createdAt)}
                        <span className="text-[var(--border)] mx-1">·</span>
                        {formatRelativeTime(alert.createdAt)}
                      </span>
                    </div>
                    <h3 className="font-medium text-[var(--foreground)] mb-1 truncate">{alert.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      <span className="font-mono">來源: {alert.source}</span>
                      {alert.aiVerdict && (
                        <>
                          <span>|</span>
                          <span className="font-mono">AI: {alert.aiVerdict}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Detail */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 h-fit sticky top-6">
            {selectedAlert ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-[var(--foreground)]">告警詳情</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedAlert(null)}
                  >
                    關閉
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--muted-foreground)] font-mono">標題</label>
                    <p className="text-[var(--foreground)]">{selectedAlert.title}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] font-mono">嚴重等級</label>
                      <div className="mt-1">
                        <StatusBadge
                          variant={selectedAlert.severity === 'critical' ? 'danger' : selectedAlert.severity === 'high' ? 'danger' : selectedAlert.severity === 'medium' ? 'warning' : selectedAlert.severity === 'low' ? 'info' : 'muted'}
                          dot
                        >
                          {selectedAlert.severity.toUpperCase()}
                        </StatusBadge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] font-mono">狀態</label>
                      <p className="text-[var(--foreground)]">{ALERT_STATUS[selectedAlert.status as keyof typeof ALERT_STATUS]?.label || selectedAlert.status}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] font-mono">來源</label>
                      <p className="text-[var(--foreground)]">{selectedAlert.source}</p>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] font-mono">時間</label>
                      <p className="text-[var(--foreground)]">{formatTaipeiDateTime(selectedAlert.createdAt)}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--muted-foreground)] font-mono">AI 判斷</label>
                    <p className="text-[var(--foreground)]">{selectedAlert.aiVerdict || '-'}</p>
                  </div>

                  {selectedAlert.humanVerdict && (
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] font-mono">人工判斷</label>
                      <p className="text-[var(--foreground)]">{selectedAlert.humanVerdict}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-[var(--muted-foreground)] font-mono">原始內容</label>
                    <pre className="mt-1 p-2 bg-[var(--background)] rounded text-xs font-mono text-[var(--foreground)] overflow-auto max-h-32">
                      {formatRawContent(selectedAlert.rawContent)}
                    </pre>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-[var(--border)] flex gap-2 flex-wrap">
                  {selectedAlert.status === 'new' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleInvestigate(selectedAlert.id)}
                        className="bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        開始調查
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(selectedAlert.id, 'false_positive')}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        標記誤報
                      </Button>
                    </>
                  )}
                  {selectedAlert.status === 'investigating' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleResolve(selectedAlert.id, 'resolved')}
                        className="bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        標記已處理
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(selectedAlert.id, 'ignored')}
                      >
                        標記已忽略
                      </Button>
                    </>
                  )}
                  {selectedAlert.status === 'failed_resolution' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleResolve(selectedAlert.id, 'investigating')}
                        className="bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        重新調查
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleResolve(selectedAlert.id, 'resolved')}
                        className="bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        標記已處理
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(selectedAlert.id, 'ignored')}
                      >
                        標記已忽略
                      </Button>
                    </>
                  )}
                  {selectedAlert.status !== 'resolved' && selectedAlert.status !== 'ignored' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(selectedAlert.id, 'false_positive')}
                      className="text-orange-500"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      標記為誤報
                    </Button>
                  )}

                  {/* Knowledge Feedback Button */}
                  {selectedAlert.aiVerdict && selectedAlert.humanVerdict !== selectedAlert.aiVerdict && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFeedbackForm({
                          correct_verdict: selectedAlert.humanVerdict || '',
                          error_reason: '',
                          lesson: '',
                        });
                        setShowFeedbackModal(true);
                      }}
                      className="text-purple-500"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      知識回饋
                    </Button>
                  )}

                  {/* Generate Report Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const data = await api.dashboard.report(selectedAlert.id);
                        setReportData(data as unknown as ReportData);
                        setShowReportModal(true);
                      } catch (err) {
                        console.error('Failed to generate report:', err);
                      }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    生成報告
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--muted-foreground)]">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>選擇一個告警查看詳情</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Feedback Modal */}
      {showFeedbackModal && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[var(--foreground)]">知識回饋</h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--muted-foreground)] font-mono">AI 判斷</label>
                <p className="text-[var(--foreground)]">{selectedAlert.aiVerdict}</p>
              </div>

              <div>
                <label className="text-xs text-[var(--muted-foreground)] font-mono">人工結論 *</label>
                <input
                  type="text"
                  value={feedbackForm.correct_verdict}
                  onChange={(e) => setFeedbackForm(f => ({ ...f, correct_verdict: e.target.value }))}
                  placeholder="輸入正確的結論"
                  className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--muted-foreground)] font-mono">錯誤原因（選填）</label>
                <textarea
                  value={feedbackForm.error_reason}
                  onChange={(e) => setFeedbackForm(f => ({ ...f, error_reason: e.target.value }))}
                  placeholder="說明 AI 判斷錯誤的原因"
                  className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-xs text-[var(--muted-foreground)] font-mono">知識補充（選填）</label>
                <textarea
                  value={feedbackForm.lesson}
                  onChange={(e) => setFeedbackForm(f => ({ ...f, lesson: e.target.value }))}
                  placeholder="分享這次判斷的經驗或知識"
                  className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)]"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={async () => {
                    if (!feedbackForm.correct_verdict) return;
                    setSubmitting(true);
                    try {
                      await api.alerts.submitFeedback(selectedAlert.id, {
                        ai_verdict: selectedAlert.aiVerdict || '',
                        correct_verdict: feedbackForm.correct_verdict,
                        error_reason: feedbackForm.error_reason || undefined,
                        lesson: feedbackForm.lesson || undefined,
                      });
                      setShowFeedbackModal(false);
                      await fetchAlerts();
                    } catch (err) {
                      console.error('Failed to submit feedback:', err);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting || !feedbackForm.correct_verdict}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-1" />
                  {submitting ? '提交中...' : '送出'}
                </Button>
                <Button variant="outline" onClick={() => setShowFeedbackModal(false)}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && reportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] w-full max-w-2xl p-6 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[var(--foreground)]">調查報告</h3>
              <button onClick={() => setShowReportModal(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Alert Summary */}
              <div className="p-4 bg-[var(--background)] rounded-lg">
                <h4 className="font-medium text-[var(--foreground)] mb-2">{reportData.alert?.title}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>嚴重程度: <span className="text-red-500">{reportData.alert?.severity}</span></div>
                  <div>狀態: {reportData.alert?.status}</div>
                  <div>來源: {reportData.alert?.source}</div>
                  <div>時間: {formatDateTime(reportData.alert?.createdAt)}</div>
                </div>
              </div>

              {/* AI Analysis */}
              <div>
                <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">AI 分析</h4>
                <div className="p-3 bg-[var(--background)] rounded-lg text-sm">
                  <div className="font-mono text-[var(--terminal-green)]">結論: {reportData.aiAnalysis?.verdict || 'N/A'}</div>
                </div>
              </div>

              {/* Tool Executions */}
              {(reportData.toolExecutionSummary?.total ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">
                    工具執行 ({reportData.toolExecutionSummary?.total ?? 0})
                  </h4>
                  <div className="space-y-2">
                    {reportData.toolExecutionSummary?.executions?.map((exec, idx) => (
                      <div key={idx} className="p-3 bg-[var(--background)] rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{exec.tool}</span>
                          <StatusBadge variant={exec.status === 'success' ? 'success' : 'danger'}>
                            {exec.status}
                          </StatusBadge>
                          {exec.durationMs && (
                            <span className="text-xs text-[var(--muted-foreground)]">{exec.durationMs}ms</span>
                          )}
                        </div>
                        {exec.output && (
                          <pre className="mt-2 p-2 bg-[var(--card)] rounded text-xs font-mono overflow-auto max-h-24">
                            {exec.output.slice(0, 500)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {(reportData.recommendations?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">建議</h4>
                  <ul className="space-y-1">
                    {reportData.recommendations?.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                        <span className="text-[var(--terminal-green)]">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Copy/Download buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  複製 JSON
                </Button>
                <Button variant="outline" onClick={() => setShowReportModal(false)}>
                  關閉
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--terminal-green)] border-t-transparent" />
      </div>
    }>
      <AlertsContent />
    </Suspense>
  );
}
