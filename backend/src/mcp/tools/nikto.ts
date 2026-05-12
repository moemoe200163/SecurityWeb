import { MCPTool } from '../types.js';

export const niktoTool: MCPTool = {
  name: 'nikto_scan',
  description: 'Execute nikto web vulnerability scan.',
  parameters: {
    target: {
      type: 'string',
      description: 'Target host or URL',
      required: true,
    },
    port: {
      type: 'string',
      description: 'Port number',
      required: false,
      default: '80',
    },
  },
};

export function buildNiktoCommand(args: Record<string, string | number | boolean>): string[] {
  const { target, port = '80' } = args;
  // Return as array: ['nikto', '-h', 'target:port', '-Format', 'txt', '-output', 'nikto_results.txt']
  return ['nikto', '-h', `${target}:${port}`, '-Format', 'txt', '-output', 'nikto_results.txt'];
}