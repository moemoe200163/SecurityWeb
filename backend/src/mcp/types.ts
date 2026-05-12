export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean';
      description: string;
      required: boolean;
      default?: string | number | boolean;
    };
  };
}

export interface MCToolCall {
  name: string;
  arguments: Record<string, string | number | boolean>;
}

export interface MCToolResponse {
  success: boolean;
  output: string;
  error?: string;
}