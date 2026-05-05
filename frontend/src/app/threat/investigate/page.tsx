'use client';

import { useEffect } from 'react';
import { useStepStore } from '@/stores/stepStore';
import { StepProgress } from '@/components/steps/StepProgress';
import { StepList } from '@/components/steps/StepList';
import { AIChatPanel } from '@/components/chat/AIChatPanel';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Globe, Hash, Server } from 'lucide-react';
import type { Message } from '@/lib/types';

export default function ThreatInvestigatePage() {
  const {
    steps,
    currentStepIndex,
    isExecuting,
    messages,
    setCurrentModule,
    setStepStatus,
    setCurrentStepIndex,
    startExecution,
    stopExecution,
    addMessage,
    resetAll,
  } = useStepStore();

  useEffect(() => {
    setCurrentModule('threat');
  }, [setCurrentModule]);

  const handleStart = async () => {
    startExecution();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setCurrentStepIndex(i);
      setStepStatus(step.id, 'running');

      await new Promise((resolve) => setTimeout(resolve, 2000));
      setStepStatus(step.id, 'success');

      if (!useStepStore.getState().isExecuting) break;
    }

    stopExecution();
  };

  const handleSendMessage = (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `已收到：${text}\n\n正在分析中，請稍候...`,
        timestamp: new Date().toISOString(),
      };
      addMessage(aiResponse);
    }, 1000);
  };

  return (
    <div className="h-full flex flex-col">
      <StepProgress steps={steps} currentStepIndex={currentStepIndex} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Investigation Input */}
          <Card className="p-6">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" />
              威脅情報調查
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="輸入 IP、Domain 或 Hash..."
                    disabled={isExecuting}
                  />
                </div>
                <Button onClick={handleStart} disabled={isExecuting}>
                  <Search className="h-4 w-4 mr-2" />
                  開始調查
                </Button>
              </div>
              <div className="flex gap-2 text-sm text-gray-500">
                <Globe className="h-4 w-4" />
                <span>IP / Domain</span>
                <Hash className="h-4 w-4 ml-4" />
                <span>Hash</span>
              </div>
            </div>
          </Card>

          {/* Reset Button */}
          {steps.some((s) => s.status === 'success') && !isExecuting && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={resetAll}>
                重新調查
              </Button>
            </div>
          )}

          {/* Steps */}
          <StepList steps={steps} />

          {/* Chat */}
          <AIChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            disabled={isExecuting}
          />
        </div>
      </div>
    </div>
  );
}
