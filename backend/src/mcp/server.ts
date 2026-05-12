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

      // Pass the full command array directly to avoid re-parsing issues
      const result = await executor.executeDirect(cmdArray, 300000);

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
    // Format: [tool, -flag, value, -flag, value, ..., target]
    // Values are identified by: not starting with -, not empty, and next position
    let i = 1;
    while (i < cmdArray.length) {
      const part = cmdArray[i];
      if (part.startsWith('-') && part !== '-') {
        const key = part.replace(/^-+/, '');
        // Check if next is a non-flag value
        if (i + 1 < cmdArray.length &&
            !cmdArray[i + 1].startsWith('-') &&
            cmdArray[i + 1] !== '') {
          // This flag has a value
          const value = cmdArray[i + 1];
          if (/^\d+$/.test(value)) {
            args[key] = parseInt(value, 10);
          } else {
            args[key] = value;
          }
          i += 2;
        } else {
          // Boolean flag (no value following)
          args[key] = true;
          i++;
        }
      } else {
        // Non-flag element - either positional argument or standalone "-"
        if (part === '-') {
          // Standalone "-" might be a valid value, treat as string
          args['value'] = part;
        } else if (!args['target']) {
          args['target'] = part;
        }
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