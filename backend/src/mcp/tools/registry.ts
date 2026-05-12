import { MCPTool } from '../types.js';

// Tool definitions will be imported from individual tool files
export const toolRegistry: Record<string, MCPTool> = {
  // Will be populated after tools are created
};

export function getTool(name: string): MCPTool | undefined {
  return toolRegistry[name];
}

export function getAllTools(): MCPTool[] {
  return Object.values(toolRegistry);
}

export function registerTool(tool: MCPTool): void {
  toolRegistry[tool.name] = tool;
}