'use client';

import { useEffect, useCallback, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useStepStore } from '@/stores/stepStore';
import { api, pollSession, type SessionDetail } from '@/lib/api';
import type { AlertData, Message, ToolCall } from '@/lib/types';
import type { SessionSummary } from '@/components/soc/AnalysisSidebar';
import { VolcanoStepCard } from '@/components/soc/VolcanoStepCard';
import { ThreatSummaryCard } from '@/components/soc/ThreatSummaryCard';
import { AlertUpload } from '@/components/upload/AlertUpload';
import { PageHero } from '@/components/layout/PageHero';
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  Copy,
  Download,
  Share2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

function HistorySessionLoader({
  onLoad,
}: {
  onLoad: (sessionId: string) => void;
}) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (sessionId) {
      onLoad(sessionId);
    }
  }, [sessionId, onLoad]);

  return null;
}

interface SOCAnalysisWorkspaceProps {
  initialSessionId?: string;
}

export function SOCAnalysisWorkspace({ initialSessionId }: SOCAnalysisWorkspaceProps) {
  const {
    steps,
    currentStepIndex,
    isExecuting,
    messages,
    currentSessionId,
    setCurrentModule,
    setCurrentSessionId,
    setSteps,
    setCurrentStepIndex,
    startExecution,
    stopExecution,
    setMessages,
    addMessage,
    resetAll,
  } = useStepStore();
  void currentStepIndex; void setCurrentModule;

  const pollCleanupRef = useRef<(() => void) | null>(null);
  const [, setSidebarSession] = useState<SessionSummary | undefined>(undefined);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      pollCleanupRef.current?.();
    };
  }, []);

  // Load initial session from URL param - use inline to avoid stale callback
  useEffect(() => {
    if (!initialSessionId || initialSessionId === currentSessionId) return;

    let cancelled = false;

    const loadSession = async () => {
      try {
        // Clear any existing polling first
        if (pollCleanupRef.current) {
          pollCleanupRef.current();
          pollCleanupRef.current = null;
        }

        // Reset state
        resetAll();
        setSteps([]);
        setMessages([]);
        setCurrentStepIndex(0);
        stopExecution();

        // Fetch session
        const response = await api.soc.getSession(initialSessionId);
        if (cancelled) return;

        const session = response.session;
        setCurrentSessionId(session.id);
        setSidebarSession({
          id: session.id,
          module: session.module,
          status: session.status,
          createdAt: session.createdAt,
          title: session.steps?.[0]?.title || '分析工作階段',
        });

        // Sync steps
        if (session.steps && session.steps.length > 0) {
          setSteps(session.steps.map((s, i) => ({
            id: s.id || String(i + 1),
            title: s.title,
            status: s.status,
            content: s.content,
            codeBlock: s.codeBlock,
            toolCalls: s.toolCalls as ToolCall[],
            timestamp: s.timestamp,
          })));

          const runningIndex = session.steps.findIndex((s) => s.status === 'running');
          if (runningIndex >= 0) {
            setCurrentStepIndex(runningIndex);
          } else if (session.status === 'completed') {
            setCurrentStepIndex(session.steps.length);
            stopExecution();
          }
        }

        // Sync messages
        if (session.messages && session.messages.length > 0) {
          setMessages(session.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
          })));
        }

        // Start polling for updates if session is in progress
        if (session.status === 'in_progress') {
          pollCleanupRef.current = pollSession(
            session.id,
            'soc',
            (updatedSession) => {
              setSidebarSession({
                id: updatedSession.id,
                module: updatedSession.module,
                status: updatedSession.status,
                createdAt: updatedSession.createdAt,
                title: updatedSession.steps?.[0]?.title || '分析工作階段',
              });
              if (updatedSession.steps && updatedSession.steps.length > 0) {
                setSteps(updatedSession.steps.map((s, i) => ({
                  id: s.id || String(i + 1),
                  title: s.title,
                  status: s.status,
                  content: s.content,
                  codeBlock: s.codeBlock,
                  toolCalls: s.toolCalls as ToolCall[],
                  timestamp: s.timestamp,
                })));
                const runningIndex = updatedSession.steps.findIndex((s) => s.status === 'running');
                if (runningIndex >= 0) {
                  setCurrentStepIndex(runningIndex);
                } else if (updatedSession.status === 'completed') {
                  setCurrentStepIndex(updatedSession.steps.length);
                  stopExecution();
                }
              }
              if (updatedSession.messages && updatedSession.messages.length > 0) {
                setMessages(updatedSession.messages.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  timestamp: m.createdAt,
                })));
              }
            }
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load session:', err);
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store setters and refs are stable; depending on them would re-fire on every render
  }, [initialSessionId]);

  // Handle history session load
  const handleLoadSession = useCallback(async (sessionId: string) => {
    try {
      resetAll();
      const response = await api.soc.getSession(sessionId);
      const session = response.session;

      setCurrentSessionId(session.id);
      setSidebarSession({
        id: session.id,
        module: session.module,
        status: session.status,
        createdAt: session.createdAt,
        title: session.steps?.[0]?.title || '分析工作階段',
      });

      // Sync steps
      if (session.steps && session.steps.length > 0) {
        setSteps(session.steps.map((s, i) => ({
          id: s.id || String(i + 1),
          title: s.title,
          status: s.status,
          content: s.content,
          codeBlock: s.codeBlock,
          toolCalls: s.toolCalls as ToolCall[],
          timestamp: s.timestamp,
        })));

        const runningIndex = session.steps.findIndex((s) => s.status === 'running');
        if (runningIndex >= 0) {
          setCurrentStepIndex(runningIndex);
        } else if (session.status === 'completed') {
          setCurrentStepIndex(session.steps.length);
          stopExecution();
        }
      }

      // Sync messages
      if (session.messages && session.messages.length > 0) {
        setMessages(session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt,
        })));
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      alert('載入歷史記錄失敗');
    }
  }, [resetAll, setCurrentSessionId, setSteps, setCurrentStepIndex, setMessages, stopExecution]);

  // Sync session steps with store
  const syncSessionToStore = useCallback((session: SessionDetail) => {
    setSidebarSession({
        id: session.id,
        module: session.module,
        status: session.status,
        createdAt: session.createdAt,
        title: session.steps?.[0]?.title || '分析工作階段',
      });

    if (session.steps && session.steps.length > 0) {
      setSteps(session.steps.map((s, i) => ({
        id: s.id || String(i + 1),
        title: s.title,
        status: s.status,
        content: s.content,
        codeBlock: s.codeBlock,
        toolCalls: s.toolCalls as ToolCall[],
        timestamp: s.timestamp,
      })));

      const runningIndex = session.steps.findIndex((s) => s.status === 'running');
      if (runningIndex >= 0) {
        setCurrentStepIndex(runningIndex);
      } else if (session.status === 'completed') {
        setCurrentStepIndex(session.steps.length);
        stopExecution();
      }
    }

    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })));
    }
  }, [setSteps, setCurrentStepIndex, setMessages, stopExecution]);

  // Start analysis with API
  const handleAlertSubmit = async (data: AlertData) => {
    try {
      resetAll();
      startExecution();

      const response = await api.soc.analyze({
        alertId: data.alertId,
        rawContent: data.rawContent,
      });

      setCurrentSessionId(response.sessionId);

      if (pollCleanupRef.current) {
        pollCleanupRef.current();
      }
      pollCleanupRef.current = pollSession(
        response.sessionId,
        'soc',
        (session) => {
          syncSessionToStore(session);
        }
      );

      // Auto-send initial message to trigger MiniMax analysis
      const initialPrompt = `請分析以下安全告警數據，生成結構化威脅報告：

${data.rawContent || data.alertId}

【報告格式要求】
1. 首先輸出威脅判定：⚠️ 風險等級 + 攻擊類型
2. 六章報告：事件概要、IOC、ATT&CK、技術分析、業務影響、處置建議
3. ⚠️ 標註待確認資訊（IP、帳戶）並列為最優先
4. 禁止重複內容，章節間不複製貼上`;

      setTimeout(async () => {
        try {
          const msg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: initialPrompt,
            timestamp: new Date().toISOString(),
          };
          addMessage(msg);

          const msgResponse = await api.soc.sendMessage(response.sessionId, initialPrompt);
          addMessage({
            id: msgResponse.message.id,
            role: 'assistant',
            content: msgResponse.message.content,
            timestamp: msgResponse.message.createdAt,
          });
        } catch (err) {
          console.error('Initial message error:', err);
        }
      }, 1000);
    } catch (error) {
      console.error('Analysis error:', error);
      stopExecution();
      alert('分析啟動失敗：' + (error as Error).message);
    }
  };

  // Quick actions handler
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'copy-report':
        {
          const content = messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
          navigator.clipboard.writeText(content);
        }
        break;
      case 'download-report':
        {
          const content = messages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
          const report = `# SOC 安全分析報告\n\n**時間：** ${new Date().toLocaleString('zh-TW')}\n\n---\n\n${content}`;
          const blob = new Blob([report], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `SOC-Report-${new Date().toISOString().slice(0, 10)}.md`;
          a.click();
          URL.revokeObjectURL(url);
        }
        break;
      case 'share-report':
        {
          if (currentSessionId) {
            navigator.clipboard.writeText(`${window.location.origin}/soc/analyze?session=${currentSessionId}`);
          }
        }
        break;
      case 'refresh-data':
        if (currentSessionId) {
          api.soc.getSession(currentSessionId).then((res) => {
            syncSessionToStore(res.session);
          });
        }
        break;
      default:
        break;
    }
  };

  // Calculate progress
  const completedSteps = steps.filter((s) => s.status === 'success').length;
  const totalSteps = steps.length || 5;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  // Extract threat summary from AI response
  const extractThreatSummary = () => {
    const aiMessage = messages.find(m => m.role === 'assistant' && m.content.includes('勒索軟體'));
    if (!aiMessage) return null;

    const content = aiMessage.content;

    // 解析威脅判定 - 匹配 ⚠️ 或 🔴 开头的行
    const threatVerdictMatch = content.match(/[⚠️🔴][^\n]+/);
    const riskLevelMatch = content.match(/嚴重性[：:][^\n]+/);

    // 解析主要結論 - 從第一章节提取
    const section1Match = content.match(/一、事件概要[\s\S]*?(?=\n##|$)/);
    const mainConclusion = section1Match ? section1Match[0].replace(/^一、事件概要\n*/,'').substring(0, 200).trim() : '';

    // 解析影響範圍 - 提取受影響資產
    const impactMatch = content.match(/受影響資產[：:]?[^\n]+/);
    const impactScope = impactMatch ? impactMatch[0].replace(/受影響資產[：:]?/, '').trim() : '';

    // 解析目前狀態 - 從業務影響評估章节提取
    const statusMatch = content.match(/整體風險[：:][^\n]+/);
    const currentStatus = statusMatch ? statusMatch[0].replace(/整體風險[：:]?/, '').trim() : '';

    // 解析立即建議 - 從第六章提取 numbered list
    const actionsMatch = content.match(/六、處置建議[\s\S]*?(?=\n##|\n#|$)/);
    let immediateActions: string[] = [];
    if (actionsMatch) {
      const actionText = actionsMatch[0];
      // 提取所有 numbered items
      const numberedItems = actionText.match(/\d+\.[^\n]+/g) || [];
      immediateActions = numberedItems.map(a => a.replace(/^\d+\.\s*/, '').substring(0, 100));
    }

    return {
      threatVerdict: threatVerdictMatch ? threatVerdictMatch[0].replace(/[⚠️🔴]/g, '').trim() : '分析中',
      riskLevel: riskLevelMatch ? riskLevelMatch[0].split('：')[1] || riskLevelMatch[0].split(':')[1] || '' : '',
      mainConclusion: mainConclusion || '參見事件概要章节',
      impactScope: impactScope || '兩台主機（詳細見IOC表格）',
      currentStatus: currentStatus || '攻擊進行中',
      immediateActions: immediateActions.slice(0, 5),
    };
  };

  // Download PDF
  const handleDownloadPDF = () => {
    if (!currentSessionId) return;
    window.open(`/api/soc/sessions/${currentSessionId}/report`, '_blank');
  };

  // Copy summary
  const handleCopySummary = () => {
    const summary = extractThreatSummary();
    if (summary) {
      const text = `【威脅判定】：${summary.threatVerdict}
風險等級：${summary.riskLevel}
主要結論：${summary.mainConclusion}
影響範圍：${summary.impactScope}
目前狀態：${summary.currentStatus}
立即建議：${summary.immediateActions.join('；')}`;
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <PageHero
          icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
          title="SOC 深度調查"
          subtitle="ALERT ANALYSIS WORKFLOW"
          command="soc-investigate --progress"
          commandValue={`${completedSteps}/${totalSteps}`}
        />

        {/* Top Progress Bar */}
        <div className="bg-[var(--card)] border-y border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-[var(--card-foreground)]">威脅分析工作流</h2>
              {isExecuting && (
                <div className="flex items-center gap-2 text-sm text-[--color-soc]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>分析中...</span>
                </div>
              )}
              {steps.every((s) => s.status === 'success') && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>分析完成</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Progress text */}
              <span className="text-sm text-[var(--muted-foreground)]">
                {completedSteps} / {totalSteps} 步驟
              </span>

              {/* Quick Actions */}
              {currentSessionId && !isExecuting && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickAction('copy-report')}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
                    title="複製報告"
                  >
                    <Copy className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={() => handleQuickAction('download-report')}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
                    title="下載報告"
                  >
                    <Download className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={() => handleQuickAction('share-report')}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
                    title="分享連結"
                  >
                    <Share2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={() => handleQuickAction('refresh-data')}
                    className="p-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors"
                    title="刷新數據"
                  >
                    <RefreshCw className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </button>
                  <button
                    onClick={() => {
                      resetAll();
                      setSidebarSession(undefined);
                    }}
                    className="p-2 rounded-lg border border-red-200/50 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    title="終止工作階段"
                  >
                    <XCircle className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              )}

              {/* Reset */}
              {currentSessionId && !isExecuting && (
                <Button variant="outline" size="sm" onClick={() => {
                  resetAll();
                  setSidebarSession(undefined);
                }}>
                  重新分析
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-[--color-soc]'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Steps Timeline */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Upload Section */}
                {!currentSessionId && !isExecuting && (
                  <AlertUpload onSubmit={handleAlertSubmit} disabled={isExecuting} />
                )}

                {/* Steps Timeline */}
                {steps.length > 0 && (
                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <VolcanoStepCard
                        key={step.id}
                        step={step}
                        stepNumber={index + 1}
                        isLast={index === steps.length - 1}
                      />
                    ))}
                  </div>
                )}

                {/* Threat Summary Card */}
                {messages.length > 0 && extractThreatSummary() && (
                  <ThreatSummaryCard
                    threatVerdict={extractThreatSummary()!.threatVerdict}
                    mainConclusion={extractThreatSummary()!.mainConclusion}
                    riskLevel={extractThreatSummary()!.riskLevel}
                    impactScope={extractThreatSummary()!.impactScope}
                    currentStatus={extractThreatSummary()!.currentStatus}
                    immediateActions={extractThreatSummary()!.immediateActions}
                    onDownloadPDF={handleDownloadPDF}
                    onCopySummary={handleCopySummary}
                  />
                )}

                {/* No steps yet */}
                {!currentSessionId && (
                  <div className="text-center py-12 text-[var(--muted-foreground)]">
                    <p>上傳告警數據開始分析</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* History Session Loader */}
        <Suspense fallback={null}>
          <HistorySessionLoader onLoad={handleLoadSession} />
        </Suspense>
      </div>
    </div>
  );
}
