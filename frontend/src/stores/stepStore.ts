import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Step, Message, ModuleType, ToolCall } from '@/lib/types';

interface StepStore {
  // Current module
  currentModule: ModuleType;
  setCurrentModule: (module: ModuleType) => void;

  // Current session
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;

  // Steps
  steps: Step[];
  setSteps: (steps: Step[]) => void;
  updateStep: (id: string, updates: Partial<Step>) => void;
  setStepStatus: (id: string, status: Step['status']) => void;
  addToolCall: (stepId: string, toolCall: ToolCall) => void;

  // Execution control
  isExecuting: boolean;
  currentStepIndex: number;
  startExecution: () => void;
  stopExecution: () => void;
  setCurrentStepIndex: (index: number) => void;

  // Messages
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  clearMessages: () => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Reset
  resetAll: () => void;
}

const defaultSteps: Record<ModuleType, Step[]> = {
  soc: [
    { id: '1', title: '接收告警', status: 'pending', content: '等待接收安全告警...' },
    { id: '2', title: '威脅情報', status: 'pending', content: '正在關聯威脅情報...' },
    { id: '3', title: '攻擊還原', status: 'pending', content: '正在還原攻擊過程...' },
    { id: '4', title: '影響評估', status: 'pending', content: '正在評估業務影響...' },
    { id: '5', title: '處置建議', status: 'pending', content: '正在生成處置建議...' },
  ],
  threat: [
    { id: '1', title: '收集資料', status: 'pending', content: '正在收集目標資料...' },
    { id: '2', title: '擴展線索', status: 'pending', content: '正在擴展關聯線索...' },
    { id: '3', title: '關聯分析', status: 'pending', content: '正在進行關聯分析...' },
    { id: '4', title: '攻擊路徑', status: 'pending', content: '正在描繪攻擊路徑...' },
    { id: '5', title: '威脅報告', status: 'pending', content: '正在生成威脅報告...' },
  ],
  pentest: [
    { id: '1', title: '目標枚舉', status: 'pending', content: '正在枚舉目標範圍...' },
    { id: '2', title: '漏洞掃描', status: 'pending', content: '正在掃描潛在漏洞...' },
    { id: '3', title: '漏洞驗證', status: 'pending', content: '正在驗證發現的漏洞...' },
    { id: '4', title: '漏洞利用', status: 'pending', content: '正在評估漏洞利用可行性...' },
    { id: '5', title: '報告生成', status: 'pending', content: '正在生成滲透測試報告...' },
  ],
};

const templateWorkflowSteps: Record<string, Array<{ title: string; content: string }>> = {
  network_scan: [
    { title: '範圍確認', content: '正在確認掃描目標與授權範圍...' },
    { title: '主機/端口發現', content: '正在掃描存活主機與開放端口...' },
    { title: '服務指紋', content: '正在識別端口上運行的服務與版本...' },
    { title: '漏洞對應', content: '正在將發現的服務版本對應到已知漏洞...' },
    { title: '報告', content: '正在彙整發現並生成滲透測試報告...' },
  ],
  web_pentest: [
    { title: 'URL 基線', content: '正在建立目標 URL 基線資訊...' },
    { title: '爬取/端點盤點', content: '正在爬取網站並盤點所有端點...' },
    { title: 'OWASP 檢查', content: '正在執行 OWASP Top 10 安全檢查...' },
    { title: '證據整理', content: '正在整理漏洞利用的證據與截圖...' },
    { title: '報告', content: '正在彙整發現並生成 Web 滲透測試報告...' },
  ],
  api_test: [
    { title: '端點/規格盤點', content: '正在盤點所有 API 端點與規格...' },
    { title: '認證檢查', content: '正在測試認證機制的安全性...' },
    { title: 'Injection/Schema 測試', content: '正在測試注入漏洞與 Schema 驗證...' },
    { title: '業務邏輯', content: '正在測試業務邏輯漏洞...' },
    { title: '報告', content: '正在彙整發現並生成 API 安全測試報告...' },
  ],
  red_team: [
    { title: '授權範圍', content: '正在確認攻擊授權範圍與規則...' },
    { title: '偵察', content: '正在收集目標情報與暴露面...' },
    { title: '攻擊路徑建模', content: '正在建模可行的攻擊路徑...' },
    { title: '防禦控制驗證', content: '正在驗證防禦控制的有效性...' },
    { title: '管理層報告', content: '正在生成管理層可讀的演練報告...' },
  ],
  brute_force: [
    { title: '授權確認', content: '正在確認暴力破解測試的授權...' },
    { title: '登入面盤點', content: '正在盤點所有登入入口...' },
    { title: '密碼策略測試', content: '正在測試密碼強度與策略...' },
    { title: '速率限制/鎖定證據', content: '正在驗證速率限制與帳戶鎖定機制...' },
    { title: '加固報告', content: '正在生成安全加固建議報告...' },
  ],
  custom: [
    { title: '需求輸入', content: '正在收集用戶的安全測試需求...' },
    { title: '參數整理', content: '正在整理測試參數與範圍...' },
    { title: '安全檢查清單', content: '正在建立對應的安全檢查清單...' },
    { title: '證據收集', content: '正在執行測試並收集證據...' },
    { title: '自訂報告', content: '正在生成自訂格式的測試報告...' },
  ],
};

export function getTemplateSteps(templateId: string): Step[] {
  const steps = templateWorkflowSteps[templateId] || templateWorkflowSteps.custom;
  return steps.map((step, index) => ({
    id: `${templateId}-${index + 1}`,
    title: step.title,
    status: 'pending' as const,
    content: step.content,
  }));
}

export const useStepStore = create<StepStore>()(
  persist(
    (set, get) => ({
      currentModule: 'soc',
      setCurrentModule: (module) => {
        set({
          currentModule: module,
          steps: defaultSteps[module],
          isExecuting: false,
          currentStepIndex: 0,
          messages: [],
          currentSessionId: null,
        });
      },

      currentSessionId: null,
      setCurrentSessionId: (id) => set({ currentSessionId: id }),

      steps: defaultSteps.soc,
      setSteps: (steps) => set({ steps }),
      updateStep: (id, updates) =>
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === id ? { ...step, ...updates } : step
          ),
        })),
      setStepStatus: (id, status) =>
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === id ? { ...step, status, timestamp: new Date().toISOString() } : step
          ),
        })),
      addToolCall: (stepId, toolCall) =>
        set((state) => ({
          steps: state.steps.map((step) =>
            step.id === stepId
              ? { ...step, toolCalls: [...(step.toolCalls || []), toolCall] }
              : step
          ),
        })),

      isExecuting: false,
      currentStepIndex: 0,
      startExecution: () => set({ isExecuting: true }),
      stopExecution: () => set({ isExecuting: false }),
      setCurrentStepIndex: (index) => set({ currentStepIndex: index }),

      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      clearMessages: () => set({ messages: [] }),

      theme: 'light',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      resetAll: () =>
        set((state) => ({
          steps: defaultSteps[state.currentModule],
          isExecuting: false,
          currentStepIndex: 0,
          messages: [],
          currentSessionId: null,
        })),
    }),
    {
      name: 'security-web-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
