import { prisma } from '../db/client.js';
import type { AIService, ModuleType, SessionData, StepData, MessageData } from './types.js';

// Default steps for each module
const defaultSteps: Record<ModuleType, Omit<StepData, 'id' | 'timestamp'>[]> = {
  soc: [
    { order: 1, title: '接收告警', status: 'pending', content: '等待接收安全告警...' },
    { order: 2, title: '威脅情報', status: 'pending', content: '正在關聯威脅情報...' },
    { order: 3, title: '攻擊還原', status: 'pending', content: '正在還原攻擊過程...' },
    { order: 4, title: '影響評估', status: 'pending', content: '正在評估業務影響...' },
    { order: 5, title: '處置建議', status: 'pending', content: '正在生成處置建議...' },
  ],
  threat: [
    { order: 1, title: '收集資料', status: 'pending', content: '正在收集目標資料...' },
    { order: 2, title: '擴展線索', status: 'pending', content: '正在擴展關聯線索...' },
    { order: 3, title: '關聯分析', status: 'pending', content: '正在進行關聯分析...' },
    { order: 4, title: '攻擊路徑', status: 'pending', content: '正在描繪攻擊路徑...' },
    { order: 5, title: '威脅報告', status: 'pending', content: '正在生成威脅報告...' },
  ],
  pentest: [
    { order: 1, title: '目標枚舉', status: 'pending', content: '正在枚舉目標範圍...' },
    { order: 2, title: '漏洞掃描', status: 'pending', content: '正在掃描潛在漏洞...' },
    { order: 3, title: '漏洞驗證', status: 'pending', content: '正在驗證發現的漏洞...' },
    { order: 4, title: '漏洞利用', status: 'pending', content: '正在評估漏洞利用可行性...' },
    { order: 5, title: '報告生成', status: 'pending', content: '正在生成滲透測試報告...' },
  ],
};

// Mock content for SOC analysis
const mockSOCContent: Record<number, { content: string; codeBlock?: string }> = {
  1: {
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
  2: {
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
  3: {
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
  4: {
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
  5: {
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

function formatSession(session: any): SessionData {
  return {
    id: session.id,
    module: session.module,
    input: session.input,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    steps: session.steps.map((step: any) => ({
      id: step.id,
      order: step.order,
      title: step.title,
      status: step.status,
      content: step.content || undefined,
      codeBlock: step.codeBlock || undefined,
      toolCalls: step.toolCalls || undefined,
      timestamp: step.timestamp?.toISOString() || undefined,
    })),
    messages: session.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    })),
  };
}

export class MockAIService implements AIService {
  async startAnalysis(module: ModuleType, input: unknown): Promise<SessionData> {
    const steps = defaultSteps[module].map((step, index) => ({
      ...step,
      id: `step-${Date.now()}-${index}`,
      timestamp: new Date().toISOString(),
    }));

    const session = await prisma.session.create({
      data: {
        module,
        input: input as object,
        status: 'in_progress',
        steps: {
          create: steps.map((step) => ({
            order: step.order,
            title: step.title,
            status: step.status,
            content: step.content,
            codeBlock: step.codeBlock,
          })),
        },
      },
      include: {
        steps: true,
        messages: true,
      },
    });

    return formatSession(session);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) return null;
    return formatSession(session);
  }

  async getAllSessions(): Promise<SessionData[]> {
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return sessions.map(formatSession);
  }

  async sendMessage(sessionId: string, content: string): Promise<MessageData> {
    // Add user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    // Simulate AI response
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    let responseContent = `已收到您的問題：「${content}」\n\n`;

    if (session) {
      const currentStep = session.steps.find((s) => s.status === 'running');
      if (currentStep) {
        responseContent += `目前正在處理：${currentStep.title}\n\n請稍候，分析完成後會第一時間通知您。`;
      } else {
        responseContent += `當前分析已全部完成，您可以在報告區查看完整結果。`;
      }
    }

    const aiMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: responseContent,
      },
    });

    return {
      id: aiMessage.id,
      role: aiMessage.role as 'user' | 'assistant',
      content: aiMessage.content,
      createdAt: aiMessage.createdAt.toISOString(),
    };
  }

  async getStepStatus(sessionId: string, stepId: string): Promise<StepData | null> {
    const step = await prisma.step.findFirst({
      where: { id: stepId, sessionId },
    });

    if (!step) return null;

    return {
      id: step.id,
      order: step.order,
      title: step.title,
      status: step.status as any,
      content: step.content || undefined,
      codeBlock: step.codeBlock || undefined,
      toolCalls: (step.toolCalls as any) || undefined,
      timestamp: step.timestamp?.toISOString() || undefined,
    };
  }

  // Helper method to update step content (used by simulation)
  async updateStepContent(stepId: string, content: string, codeBlock?: string): Promise<void> {
    await prisma.step.update({
      where: { id: stepId },
      data: {
        content,
        codeBlock,
        timestamp: new Date(),
      },
    });
  }

  // Helper method to mark step as success
  async completeStep(stepId: string): Promise<void> {
    await prisma.step.update({
      where: { id: stepId },
      data: {
        status: 'success',
        timestamp: new Date(),
      },
    });
  }

  // Get mock content for SOC (used by simulation)
  getMockContent(order: number): { content: string; codeBlock?: string } | undefined {
    return mockSOCContent[order];
  }
}

export const aiService = new MockAIService();
