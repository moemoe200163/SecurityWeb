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

export interface PentestInput {
  template: string;
  target: string;
  scope?: string;
  testType?: string;
  ports?: string;
  intensity?: string;
  url?: string;
  auth?: string;
  cookies?: string;
  endpoint?: string;
  method?: string;
  headers?: string;
  service?: string;
  username?: string;
  customInput?: string;
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
  requestMode: 'simulation' | 'live';
}

export interface PentestAssistRequest {
  target: string;
  scope: string;
  testType: string;
  type: 'simulation' | 'live';
}

export interface TemplateStep {
  title: string;
  description: string;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  purpose: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiredInputs: string[];
  optionalInputs: string[];
  reportType: string;
  steps: TemplateStep[];
  isHighRisk: boolean;
}

// AI Service interface
export interface AIService {
  startAnalysis(module: ModuleType, input: unknown): Promise<SessionData>;
  getSession(sessionId: string): Promise<SessionData | null>;
  getAllSessions(): Promise<SessionData[]>;
  sendMessage(sessionId: string, content: string): Promise<MessageData>;
  getStepStatus(sessionId: string, stepId: string): Promise<StepData | null>;
  updateStepContent(stepId: string, content: string): Promise<void>;
  completeStep(stepId: string): Promise<void>;
  completeSession(sessionId: string): Promise<void>;
}

// Tool Execution types
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface ToolExecutionRequest {
  tool: string;
  args: Record<string, string | number | boolean>;
  timeout?: number;
}
