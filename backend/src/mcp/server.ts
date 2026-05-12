import { SandboxManager } from '../services/SandboxManager.js';
import { getTool, getAllTools } from './tools/registry.js';
import { buildNmapCommand } from './tools/nmap.js';
import { buildSqlmapCommand } from './tools/sqlmap.js';
import { buildNiktoCommand } from './tools/nikto.js';
import { buildHydraCommand } from './tools/hydra.js';
import { MCToolCall, MCToolResponse, MCPTool } from './types.js';

const commandBuilders: Record<string, (args: Record<string, string | number | boolean>) => string[]> = {
  nmap_scan: buildNmapCommand,
  sqlmap_scan: buildSqlmapCommand,
  nikto_scan: buildNiktoCommand,
  hydra_brute: buildHydraCommand,
};

export class MCPServer {
  private sandboxManager: SandboxManager;
  private initialized: boolean = false;

  constructor() {
    this.sandboxManager = new SandboxManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.sandboxManager.ensureSandbox();
    this.initialized = true;
  }

  async executeTool(call: MCToolCall): Promise<MCToolResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const tool = getTool(call.name);
    if (!tool) {
      return { success: false, output: '', error: `Tool ${call.name} not found` };
    }

    const buildCmd = commandBuilders[call.name];
    if (!buildCmd) {
      return { success: false, output: '', error: `No command builder for ${call.name}` };
    }

    try {
      const cmdArray = buildCmd(call.arguments);
      const executor = this.sandboxManager.getExecutor();

      const result = await executor.execute({
        tool: cmdArray[0],
        args: this.parseArgsToToolArgs(cmdArray),
        timeout: 300000,
      });

      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parseArgsToToolArgs(cmdArray: string[]): Record<string, string | number | boolean> {
    const args: Record<string, string | number | boolean> = {};
    // Skip first element (tool name), parse remaining
    // Format: [tool, -flag, value, -flag, value, ...]
    let i = 1;
    while (i < cmdArray.length) {
      const part = cmdArray[i];
      if (part.startsWith('-')) {
        const key = part.replace(/^-+/, '');
        if (i + 1 < cmdArray.length && !cmdArray[i + 1].startsWith('-')) {
          const value = cmdArray[i + 1];
          // Convert numeric strings to numbers
          if (/^\d+$/.test(value)) {
            args[key] = parseInt(value, 10);
          } else if (value === 'true') {
            args[key] = true;
          } else {
            args[key] = value;
          }
          i += 2;
        } else {
          args[key] = true;
          i++;
        }
      } else {
        i++;
      }
    }
    return args;
  }

  getTools(): MCPTool[] {
    return getAllTools();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance for use across the application
let mcpServerInstance: MCPServer | null = null;

export async function getMCPServer(): Promise<MCPServer> {
  if (!mcpServerInstance) {
    mcpServerInstance = new MCPServer();
    await mcpServerInstance.initialize();
  }
  return mcpServerInstance;
}