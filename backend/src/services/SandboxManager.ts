import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor } from './ToolExecutor.js';

const execAsync = promisify(exec);

const SANDBOX_IMAGE = 'kalilinux/kali-rolling:latest';
const SANDBOX_NETWORK = 'securityweb_sandbox';
const SANDBOX_SUBNET = '172.20.0.0/16';

export class SandboxManager {
  private containerId: string | null = null;

  async ensureSandbox(): Promise<string> {
    if (this.containerId) {
      return this.containerId;
    }

    // Ensure network exists
    await this.ensureNetwork();

    // Start or reuse container
    const container = await this.startContainer();
    this.containerId = container.id;
    return container.id;
  }

  private async ensureNetwork(): Promise<void> {
    try {
      // Check if network exists
      await execAsync(`docker network inspect ${SANDBOX_NETWORK}`, { shell: '/bin/sh' });
    } catch {
      // Create network if not exists
      await execAsync(
        `docker network create --driver=bridge --subnet=${SANDBOX_SUBNET} ${SANDBOX_NETWORK}`,
        { shell: '/bin/sh' }
      );
    }
  }

  private async startContainer(): Promise<{ id: string }> {
    // Check if there's an existing stopped container to reuse
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "ancestor=${SANDBOX_IMAGE}" --format "{{.ID}}" | head -1`,
        { shell: '/bin/sh' }
      );
      const existingId = stdout.trim();
      if (existingId) {
        // Remove old container
        await execAsync(`docker rm -f ${existingId}`, { shell: '/bin/sh' });
      }
    } catch {}

    // Start new container
    const cmd = [
      'docker', 'run', '--rm', '-d',
      '--network', SANDBOX_NETWORK,
      '--memory', '2g', '--cpus', '1.0',
      '--pids-limit', '100',
      '--name', 'securityweb-sandbox',
      SANDBOX_IMAGE,
      'tail', '-f', '/dev/null'
    ].join(' ');

    const { stdout } = await execAsync(cmd, { shell: '/bin/sh' });
    return { id: stdout.trim() };
  }

  getExecutor(): ToolExecutor {
    if (!this.containerId) {
      throw new Error('Sandbox not initialized. Call ensureSandbox() first.');
    }
    return new ToolExecutor(this.containerId);
  }

  async cleanup(): Promise<void> {
    if (this.containerId) {
      try {
        await execAsync(`docker stop ${this.containerId}`, { shell: '/bin/sh' });
      } catch {}
      this.containerId = null;
    }
  }

  isInitialized(): boolean {
    return this.containerId !== null;
  }
}