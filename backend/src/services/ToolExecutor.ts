/**
 * ToolExecutor Service - Executes security tools in isolated Kali sandbox container
 */

import { spawn } from 'child_process';
import type { ToolResult, ToolExecutionRequest } from './types.js';

export class ToolExecutor {
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  async execute(request: ToolExecutionRequest): Promise<ToolResult> {
    const startTime = Date.now();
    const { tool, args, timeout = 300000 } = request;

    const cmd = this.buildCommand(tool, args);

    try {
      const result = await this.execInContainer(cmd, timeout);

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        duration: Date.now() - startTime,
      };
    }
  }

  private buildCommand(tool: string, args: Record<string, string | number | boolean>): string {
    const parts: string[] = [tool];

    for (const [key, value] of Object.entries(args)) {
      if (value === undefined || value === false) {
        continue;
      }

      const prefix = key.length === 1 ? `-${key}` : `--${key}`;
      parts.push(prefix);

      // Only add value as separate argument for short flags
      // Long flags use --key=value format
      if (typeof value === 'string' && !key.startsWith('--')) {
        parts.push(value);
      } else if (typeof value === 'number' && !key.startsWith('--')) {
        parts.push(String(value));
      }
    }

    return parts.join(' ');
  }

  private async execInContainer(
    cmd: string,
    timeout: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Create abort controller for timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
        reject(new Error(`Command execution timed out after ${timeout}ms`));
      }, timeout);

      // Use docker exec with /bin/sh -c to run the command
      const proc = spawn(
        'docker',
        ['exec', '--interactive', this.containerId, '/bin/sh', '-c', cmd],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (!timedOut) {
          resolve({
            stdout,
            stderr,
            exitCode: code ?? -1,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!timedOut) {
          reject(err);
        }
      });
    });
  }
}