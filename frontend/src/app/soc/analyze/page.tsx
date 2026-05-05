'use client';

import { useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStepStore } from '@/stores/stepStore';
import { StepProgress } from '@/components/steps/StepProgress';
import { StepList } from '@/components/steps/StepList';
import { AlertUpload } from '@/components/upload/AlertUpload';
import { AIChatPanel } from '@/components/chat/AIChatPanel';
import { AnalysisReport } from '@/components/report/AnalysisReport';
import type { AlertData, Message } from '@/lib/types';

// Mock analysis data for simulation
const mockAnalysisData: Record<string, { content: string; codeBlock?: string }> = {
  '1': {
    content: `## 接收告警

已成功接收安全告警，詳情如下：

| 欄位 | 內容 |
|------|------|
| 告警 ID | SOC-2024-001 |
| 時間 | 2024-01-15 10:23:45 UTC |
| 來源 IP | 192.168.1.105 |
| 目標 IP | 10.0.0.50 |
| 事件類型 | SSH 暴力破解攻擊 |
| 攻擊次數 | 150 次 |
| 嚴重程度 | 高 |

告警已加入分析佇列，等待進一步處理。`,
  },
  '2': {
    content: `## 威脅情報關聯

正在查詢威脅情報資料庫...

**已發現威脅指標：**

| 類型 | IOC | 置信度 | 來源 |
|------|-----|--------|------|
| IP | 192.168.1.105 | 85% | 內部威脅情報 |
| IP | 192.168.1.106 | 72% | 已知的僵尸網路 |
| Hash | a1b2c3d4... | 90% | VirusTotal |

**攻擊特徵分析：**
- 攻擊時間集中在非工作時間（UTC 02:00-04:00）
- 採用低頻暴力破解策略以躲避偵測
- 攻擊源多位於同一網段`,
    codeBlock: `threat_intelligence:
  query:
    - type: ip
      value: 192.168.1.105
    - type: ip
      value: 192.168.1.106
  sources:
    - internal_cti
    - external_vt
    - threat_feeds`,
  },
  '3': {
    content: `## 攻擊過程還原

根據收集的資料，已還原攻擊時間線：

| 時間 | 動作 | 影響 |
|------|------|------|
| 10:23:45 | 首次登入嘗試 | 失敗 |
| 10:24:12 | 連續暴力破解 | 150 次失敗 |
| 10:25:30 | 發現有效帳戶 | admin |
| 10:25:35 | 橫向移動偵測 | 嘗試訪問 DB Server |
| 10:26:01 | 帳戶鎖定 | 攻擊中斷 |

**攻擊者行為模式：**
1. 自動化腳本掃描開放的 SSH 端口
2. 使用常見帳戶名進行暴力破解
3. 成功後立即嘗試橫向移動`,
  },
  '4': {
    content: `## 影響評估

**業務影響範圍：**

| 影響類別 | 嚴重程度 | 說明 |
|----------|----------|------|
| 資料機密性 | 中 | 若帳戶被破解，可能洩露客戶資料 |
| 系統可用性 | 低 | 帳戶已被鎖定，攻擊中斷 |
| 身份認證 | 高 | admin 帳戶密碼已暴露 |
| 合規性 | 中 | 可能違反資料保護法規 |

**受影響系統：**
- 10.0.0.50 (SSH Server)
- 10.0.0.51 (Database Server) - 橫向移動目標`,
  },
  '5': {
    content: `## 處置建議

### 【立即動作】
\`\`\`bash
# 1. 隔離受影響系統
sudo systemctl isolate emergency

# 2. 重置 admin 帳戶密碼
sudo passwd admin

# 3. 審查登入日誌
grep "Failed password" /var/log/auth.log | tail -100
\`\`\`

### 【短期加固】
- 啟用 SSH 金鑰認證，禁用密碼認證
- 部署 fail2ban 自動封鎖攻擊者 IP
- 設定帳戶鎖定閾值（建議：5 次失敗後鎖定）

### 【長期改善】
- 部署多因素認證 (MFA)
- 建立威脅偵測規則
- 定期安全意識培訓`,
  },
};

export default function SOCAnalyzePage() {
  const {
    steps,
    currentStepIndex,
    isExecuting,
    messages,
    setCurrentModule,
    setStepStatus,
    updateStep,
    addToolCall,
    setCurrentStepIndex,
    startExecution,
    stopExecution,
    addMessage,
    resetAll,
  } = useStepStore();

  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    setCurrentModule('soc');
  }, [setCurrentModule]);

  // Simulate step execution
  const executeStep = useCallback(
    async (stepId: string) => {
      const stepData = mockAnalysisData[stepId];
      if (!stepData) return;

      // Update step content
      updateStep(stepId, {
        content: stepData.content,
        codeBlock: stepData.codeBlock,
      });

      // Add tool call for step 2
      if (stepId === '2') {
        addToolCall(stepId, {
          toolName: 'threat_intelligence.yaml',
          status: 'calling',
          params: { query: ['192.168.1.105', '192.168.1.106'] },
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        addToolCall(stepId, {
          toolName: 'threat_intelligence.yaml',
          status: 'success',
          params: { query: ['192.168.1.105', '192.168.1.106'] },
          result: { iocs_found: 3, confidence: 'high' },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mark step as success
      setStepStatus(stepId, 'success');
    },
    [updateStep, addToolCall, setStepStatus]
  );

  // Execute all steps sequentially
  const runAnalysis = useCallback(
    async (alertData: AlertData) => {
      startExecution();
      setShowReport(false);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setCurrentStepIndex(i);
        setStepStatus(step.id, 'running');

        await executeStep(step.id);

        if (!useStepStore.getState().isExecuting) {
          break;
        }
      }

      stopExecution();
      setShowReport(true);
    },
    [steps, startExecution, setStepStatus, setCurrentStepIndex, executeStep, stopExecution]
  );

  const handleAlertSubmit = (data: AlertData) => {
    console.log('Alert submitted:', data);
    runAnalysis(data);
  };

  const handleSendMessage = (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `已收到您的問題：「${text}」\n\n根據目前的分析進度，我正在完成 [${steps[currentStepIndex]?.title || 'N/A'}] 步驟。\n\n您可以等待分析完成後，我會提供完整的建議。`,
        timestamp: new Date().toISOString(),
      };
      addMessage(aiResponse);
    }, 1000);
  };

  const handleReset = () => {
    resetAll();
    setShowReport(false);
  };

  const finalReport = `# 安全分析報告

**報告生成時間：** ${new Date().toLocaleString('zh-TW')}

---

## 1. 事件概要

本報告針對 SOC-2024-001 號告警進行全面分析。事件為一起 SSH 暴力破解攻擊，攻擊者嘗試透過自動化工具暴力破解 SSH 服務。攻擊累計 150 次嘗試，最終發現一個有效帳戶 (admin)，隨後嘗試橫向移動至資料庫伺服器，但因帳戶被鎖定而中斷。

---

## 2. 關鍵指標（IOCs）

| 類型 | 指標 | 置信度 |
|------|------|--------|
| IP | 192.168.1.105 | 85% |
| IP | 192.168.1.106 | 72% |
| Hash | a1b2c3d4e5f6... | 90% |
| 帳戶 | admin | 100% |

---

## 3. 攻擊過程還原

| 時間 | 動作 | 影響 |
|------|------|------|
| 10:23:45 | 首次登入嘗試 | 失敗 |
| 10:24:12 | 連續暴力破解 | 150 次失敗 |
| 10:25:30 | 發現有效帳戶 | admin |
| 10:25:35 | 橫向移動偵測 | 嘗試訪問 DB |
| 10:26:01 | 帳戶鎖定 | 攻擊中斷 |

---

## 4. MITRE ATT&CK 映射

| 戰術 | 技術 | 技術 ID |
|------|------|---------|
| 初始訪問 | 暴力破解 SSH | T1110.001 |
| 橫向移動 | 遠端服務 | T1021.004 |
| 發現 | 網路服務掃描 | T1046 |

---

## 5. 技術分析

攻擊者使用自動化腳本進行 SSH 暴力破解攻擊。攻擊具有以下特徵：
- 低頻攻擊策略（避免觸發速率限制）
- 針對常用帳戶名（admin, root, user）
- 攻擊時間集中在非工作時段

---

## 6. 威脅情報評估

攻擊源 IP 192.168.1.106 被識別為已知僵尸網路成員，置信度 72%。建議將相關 IP 加入封鎖清單。

---

## 7. 業務影響評估

| 影響範圍 | 嚴重程度 |
|----------|----------|
| 資料機密性 | 中 |
| 系統可用性 | 低 |
| 身份認證 | 高 |
| 合規性 | 中 |

---

## 8. 根本原因分析

主要原因為 SSH 服務使用了弱密碼，且未啟用帳戶鎖定機制。此外，管理帳戶密碼可能已在其他資料洩露事件中暴露。

---

## 9. 處置建議

### 【立即動作】
1. 重置 admin 帳戶密碼
2. 隔離受影響系統進行取證
3. 審查近期的登入日誌

### 【短期加固】
1. 啟用 SSH 金鑰認證
2. 部署 fail2ban
3. 設定帳戶鎖定閾值

### 【長期改善】
1. 部署多因素認證 (MFA)
2. 建立威脅偵測規則
3. 定期安全培訓

---

## 10. 總結與風險等級

**風險等級：** 中高

本次事件暴露了 SSH 認證機制的弱點。雖然攻擊被帳戶鎖定機制中斷，但攻擊者已成功識別有效帳戶。建議立即執行處置建議所述的緩解措施。

**後續行動：**
- 持續監控相關 IP 的活動
- 評估是否需要通知監管機構
- 安排資安事件回顧會議

---

*報告由安全智能體自動生成*`;

  return (
    <div className="h-full flex flex-col">
      {/* Top Progress */}
      <StepProgress steps={steps} currentStepIndex={currentStepIndex} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Section */}
          {!isExecuting && currentStepIndex === 0 && steps.every((s) => s.status === 'pending') && (
            <AlertUpload onSubmit={handleAlertSubmit} disabled={isExecuting} />
          )}

          {/* Execution Info */}
          {isExecuting && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-medium">分析進行中...</p>
              <p className="text-blue-600 mt-1">
                正在處理第 {currentStepIndex + 1} 步：{steps[currentStepIndex]?.title}
              </p>
            </div>
          )}

          {/* Reset Button */}
          {steps.some((s) => s.status === 'success') && !isExecuting && (
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
            disabled={isExecuting}
          />

          {/* Final Report */}
          {showReport && <AnalysisReport report={finalReport} />}
        </div>
      </div>
    </div>
  );
}
