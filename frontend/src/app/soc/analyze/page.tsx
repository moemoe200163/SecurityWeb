'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useStepStore } from '@/stores/stepStore';
import { StepProgress } from '@/components/steps/StepProgress';
import { StepList } from '@/components/steps/StepList';
import { AlertUpload } from '@/components/upload/AlertUpload';
import { AIChatPanel } from '@/components/chat/AIChatPanel';
import { AnalysisReport } from '@/components/report/AnalysisReport';
import { api, pollSession, type SessionDetail } from '@/lib/api';
import type { AlertData, Message } from '@/lib/types';

export default function SOCAnalyzePage() {
  const {
    steps,
    currentStepIndex,
    isExecuting,
    messages,
    currentSessionId,
    setCurrentModule,
    setCurrentSessionId,
    setSteps,
    setStepStatus,
    updateStep,
    addToolCall,
    setCurrentStepIndex,
    startExecution,
    stopExecution,
    setMessages,
    addMessage,
    resetAll,
  } = useStepStore();

  const [showReport, setShowReport] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const pollCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setCurrentModule('soc');
    return () => {
      if (pollCleanupRef.current) {
        pollCleanupRef.current();
      }
    };
  }, [setCurrentModule]);

  // Sync session steps with store
  const syncSessionToStore = useCallback((session: SessionDetail) => {
    if (session.steps && session.steps.length > 0) {
      setSteps(session.steps.map((s, i) => ({
        id: s.id || String(i + 1),
        title: s.title,
        status: s.status,
        content: s.content,
        codeBlock: s.codeBlock,
        toolCalls: s.toolCalls as any,
        timestamp: s.timestamp,
      })));

      // Find current running step
      const runningIndex = session.steps.findIndex((s) => s.status === 'running');
      if (runningIndex >= 0) {
        setCurrentStepIndex(runningIndex);
      } else if (session.status === 'completed') {
        setCurrentStepIndex(session.steps.length);
        stopExecution();
        setShowReport(true);
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
  }, [setSteps, setCurrentStepIndex, setMessages, stopExecution]);

  // Start analysis with API
  const handleAlertSubmit = async (data: AlertData) => {
    try {
      resetAll();
      startExecution();
      setShowReport(false);

      const response = await api.soc.analyze({
        alertId: data.alertId,
        rawContent: data.rawContent,
        type: 'live',
      });

      setCurrentSessionId(response.sessionId);

      // Start polling for updates
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
    } catch (error) {
      console.error('Analysis error:', error);
      stopExecution();
      alert('分析啟動失敗：' + (error as Error).message);
    }
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!currentSessionId) {
      alert('請先開始分析');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    try {
      const response = await api.soc.sendMessage(currentSessionId, text);
      addMessage({
        id: response.message.id,
        role: 'assistant',
        content: response.message.content,
        timestamp: response.message.createdAt,
      });
    } catch (error) {
      console.error('Send message error:', error);
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，發送消息失敗：' + (error as Error).message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Reset
  const handleReset = () => {
    if (pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }
    resetAll();
    setShowReport(false);
    setReportContent('');
  };

  // Generate report from messages
  const generateReport = () => {
    const analysisContent = messages
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('\n\n---\n\n');

    const report = `# 安全分析報告

**報告生成時間：** ${new Date().toLocaleString('zh-TW')}

---

${analysisContent || '分析內容將顯示在這裡...'}

---

*報告由安全智能體自動生成*`;

    setReportContent(report);
    return report;
  };

  // Show report when completed
  useEffect(() => {
    if (steps.every((s) => s.status === 'success') && !showReport) {
      setShowReport(true);
    }
  }, [steps, showReport]);

  return (
    <div className="h-full flex flex-col">
      {/* Top Progress */}
      <StepProgress steps={steps} currentStepIndex={currentStepIndex} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Section */}
          {!currentSessionId && !isExecuting && (
            <AlertUpload onSubmit={handleAlertSubmit} disabled={isExecuting} />
          )}

          {/* Execution Info */}
          {isExecuting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium">分析進行中...</p>
              <p className="text-blue-600 mt-1">
                {currentStepIndex < steps.length
                  ? `正在處理第 ${currentStepIndex + 1} 步：${steps[currentStepIndex]?.title}`
                  : '準備中...'}
              </p>
            </div>
          )}

          {/* Session ID */}
          {currentSessionId && (
            <div className="text-xs text-gray-500">
              工作階段 ID: {currentSessionId}
            </div>
          )}

          {/* Reset Button */}
          {currentSessionId && !isExecuting && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleReset}>
                重新分析
              </Button>
            </div>
          )}

          {/* Steps List */}
          <StepList steps={steps} />

          {/* Chat Panel */}
          <AIChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            disabled={!currentSessionId || isExecuting}
          />

          {/* Final Report */}
          {showReport && (
            <AnalysisReport
              report={reportContent || generateReport()}
              title="SOC 安全分析報告"
            />
          )}
        </div>
      </div>
    </div>
  );
}
