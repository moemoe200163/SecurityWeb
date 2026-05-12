import { MCPTool } from '../types.js';

export const hydraTool: MCPTool = {
  name: 'hydra_brute',
  description: 'Execute hydra brute force attack on target service.',
  parameters: {
    target: {
      type: 'string',
      description: 'Target IP or hostname',
      required: true,
    },
    service: {
      type: 'string',
      description: 'Service to attack: ssh, http-get, rdp, ftp',
      required: true,
    },
    user: {
      type: 'string',
      description: 'Username or path to user list',
      required: false,
      default: 'root',
    },
    pass_list: {
      type: 'string',
      description: 'Path to password list file',
      required: false,
      default: '/usr/share/wordlists/fasttrack.txt',
    },
  },
};

export function buildHydraCommand(args: Record<string, string | number | boolean>): string[] {
  const { target, service, user = 'root', pass_list = '/usr/share/wordlists/fasttrack.txt' } = args;
  // Return as array: ['hydra', '-l', 'root', '-P', '/usr/share/wordlists/fasttrack.txt', 'target', 'service']
  return ['hydra', '-l', String(user), '-P', String(pass_list), String(target), String(service)];
}