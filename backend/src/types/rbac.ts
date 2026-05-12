export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  api_key: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface ToolTemplate {
  id: string;
  name: string;
  tool: string;
  command_template: string;
  allowed_params: Record<string, string[]>;
  created_by: string;
  is_approved: boolean;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  created_at: Date;
}

export interface ToolExecutionRequest {
  template_id: string;
  params: Record<string, string>;
}

export interface ToolExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  execution_id: string;
}
