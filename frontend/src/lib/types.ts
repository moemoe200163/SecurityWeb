export type StepStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCall {
  toolName: string;
  status: 'calling' | 'success' | 'error';
  params?: Record<string, unknown>;
  result?: unknown;
}

export interface Step {
  id: string;
  title: string;
  status: StepStatus;
  content?: string;
  codeBlock?: string;
  toolCalls?: ToolCall[];
  timestamp?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type ModuleType = 'soc' | 'threat' | 'pentest';

export interface AlertData {
  alertId?: string;
  rawContent?: string;
  fileName?: string;
}

export interface InvestigationInput {
  type: 'ip' | 'domain' | 'hash';
  value: string;
}

export interface PentestInput {
  target: string;
  scope: string;
  testType: string;
}
