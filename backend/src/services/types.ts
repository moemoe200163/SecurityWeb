export type ModuleType = 'soc' | 'threat' | 'pentest';
export type StepStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCall {
  toolName: string;
  status: 'calling' | 'success' | 'error';
  params?: Record<string, unknown>;
  result?: unknown;
}

export interface StepData {
  id: string;
  order: number;
  title: string;
  status: StepStatus;
  content?: string;
  codeBlock?: string;
  toolCalls?: ToolCall[];
  timestamp?: string;
}

export interface SessionData {
  id: string;
  module: ModuleType;
  input: unknown;
  status: 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  steps: StepData[];
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// API Request types
export interface SOCAnalyzeRequest {
  alertId?: string;
  rawContent?: string;
  type: 'simulation' | 'live';
}

export interface ThreatInvestigateRequest {
  type: 'ip' | 'domain' | 'hash';
  value: string;
  type2: 'simulation' | 'live';
}

export interface PentestAssistRequest {
  target: string;
  scope: string;
  testType: string;
  type: 'simulation' | 'live';
}

// AI Service interface
export interface AIService {
  startAnalysis(module: ModuleType, input: unknown): Promise<SessionData>;
  getSession(sessionId: string): Promise<SessionData | null>;
  getAllSessions(): Promise<SessionData[]>;
  sendMessage(sessionId: string, content: string): Promise<MessageData>;
  getStepStatus(sessionId: string, stepId: string): Promise<StepData | null>;
}
