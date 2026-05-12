import { MCPTool } from '../types.js';

export const sqlmapTool: MCPTool = {
  name: 'sqlmap_scan',
  description: 'Execute sqlmap SQL injection scan on target URL.',
  parameters: {
    url: {
      type: 'string',
      description: 'Target URL to test for SQL injection',
      required: true,
    },
    risk: {
      type: 'number',
      description: 'Risk level 1-3 (higher = more invasive)',
      required: false,
      default: 1,
    },
    level: {
      type: 'number',
      description: 'Test level 1-5 (higher = more tests)',
      required: false,
      default: 1,
    },
  },
};

export function buildSqlmapCommand(args: Record<string, string | number | boolean>): string[] {
  const { url, risk = 1, level = 1 } = args;
  // Return as array: ['sqlmap', '-u', 'url', '--risk=1', '--level=1', '--batch', '--banner']
  return ['sqlmap', '-u', String(url), `--risk=${risk}`, `--level=${level}`, '--batch', '--banner'];
}