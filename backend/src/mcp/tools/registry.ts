import { MCPTool } from '../types.js';
import { nmapTool } from './nmap.js';
import { sqlmapTool } from './sqlmap.js';
import { niktoTool } from './nikto.js';
import { hydraTool } from './hydra.js';
import { holeheTool } from './holehe.js';

export const toolRegistry: Record<string, MCPTool> = {
  nmap_scan: nmapTool,
  sqlmap_scan: sqlmapTool,
  nikto_scan: niktoTool,
  hydra_brute: hydraTool,
  holehe_email: holeheTool,
};

export function getTool(name: string): MCPTool | undefined {
  return toolRegistry[name];
}

export function getAllTools(): MCPTool[] {
  return Object.values(toolRegistry);
}