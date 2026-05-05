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
