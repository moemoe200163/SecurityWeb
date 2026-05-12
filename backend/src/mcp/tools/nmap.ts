import { MCPTool } from '../types.js';

export const nmapTool: MCPTool = {
  name: 'nmap_scan',
  description: 'Execute nmap port scan on target. Returns open ports, services, and version info.',
  parameters: {
    target: {
      type: 'string',
      description: 'Target IP address or hostname',
      required: true,
    },
    ports: {
      type: 'string',
      description: 'Port range (e.g., "1-1000" or "22,80,443")',
      required: false,
      default: '-',
    },
    scan_type: {
      type: 'string',
      description: 'Scan type: -sS (SYN), -sT (TCP), -sV (version)',
      required: false,
      default: '-sV -sC',
    },
  },
};

export function buildNmapCommand(args: Record<string, string | number | boolean>): string[] {
  const { target, ports = '-', scan_type = '-sV -sC' } = args;
  // Return as array: ['nmap', '-sV', '-sC', '-p', '-', '-oA', 'nmap_results', 'target']
  return ['nmap', ...String(scan_type).split(' '), '-p', String(ports), '-oA', 'nmap_results', String(target)];
}