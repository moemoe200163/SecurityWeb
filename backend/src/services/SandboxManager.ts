import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolExecutor } from './ToolExecutor.js';

const execAsync = promisify(exec);

const SANDBOX_IMAGE = 'kalilinux/kali-rolling:latest';
const SANDBOX_NETWORK = 'securityweb_sandbox';
const SANDBOX_SUBNET = '172.20.0.0/16';
const SANDBOX_CONTAINER_NAME = 'securityweb-sandbox';

export class SandboxManager {
  private containerId: string | null = null;

  async ensureSandbox(): Promise<string> {
    // Issue 5: Check that Docker is accessible before proceeding
    await this.checkDockerAvailable();

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

  private async checkDockerAvailable(): Promise<void> {
    try {
      await execAsync('docker --version', { shell: '/bin/sh' });
    } catch (error) {
      throw new Error('Docker is not available. Please ensure Docker is installed and running.');
    }
  }

  private async ensureNetwork(): Promise<void> {
    // Use the network name as docker-compose creates it: projectname_networkname
    const fullNetworkName = `securityweb_${SANDBOX_NETWORK}`;
    try {
      // Check if network exists
      await execAsync(`docker network inspect ${fullNetworkName}`, { shell: '/bin/sh' });
    } catch {
      // Network doesn't exist, try to create it
      try {
        await execAsync(
          `docker network create --driver=bridge --subnet=${SANDBOX_SUBNET} ${fullNetworkName}`,
          { shell: '/bin/sh' }
        );
      } catch (createError) {
        // Check if error is because network already exists (race condition)
        const errorMsg = createError instanceof Error ? createError.message : String(createError);
        if (errorMsg.includes('already exists') || errorMsg.includes('network with name')) {
          // Another process created it - that's fine
          return;
        }
        throw new Error(`Failed to create Docker network '${fullNetworkName}': ${createError}`);
      }
    }
  }

  private async startContainer(): Promise<{ id: string }> {
    // Use the network name as docker-compose creates it: projectname_networkname
    const fullNetworkName = `securityweb_${SANDBOX_NETWORK}`;

    // Check if the docker-compose managed container already exists and is running
    try {
      const { stdout } = await execAsync(
        `docker inspect ${SANDBOX_CONTAINER_NAME} --format "{{.State.Running}}"`,
        { shell: '/bin/sh' }
      );
      if (stdout.trim() === 'true') {
        this.containerId = SANDBOX_CONTAINER_NAME;
        return { id: SANDBOX_CONTAINER_NAME };
      }
    } catch {
      // Container doesn't exist or isn't running
    }

    // Fallback: check if there's an existing stopped container to reuse
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "ancestor=${SANDBOX_IMAGE}" --format "{{.ID}}" | head -1`,
        { shell: '/bin/sh' }
      );
      const existingId = stdout.trim();
      if (existingId) {
        // Remove old container
        try {
          await execAsync(`docker rm -f ${existingId}`, { shell: '/bin/sh' });
        } catch {
          // Container removal failed, but we can continue and try to start fresh
        }
      }
    } catch {
      // No existing container to reuse
    }

    // Start new container using the security-tools image
    const securityToolsImage = 'securityweb-sandbox';
    const cmd = [
      'docker', 'run', '--rm', '-d',
      '--network', fullNetworkName,
      '--memory', '2g', '--cpus', '1.0',
      '--pids-limit', '100',
      '--name', SANDBOX_CONTAINER_NAME,
      securityToolsImage,
      'tail', '-f', '/dev/null'
    ].join(' ');

    try {
      const { stdout } = await execAsync(cmd, { shell: '/bin/sh' });
      const containerId = stdout.trim();
      if (!containerId) {
        throw new Error('Docker run returned empty container ID. Ensure Docker is running properly.');
      }
      return { id: containerId };
    } catch (error) {
      throw new Error(`Failed to start sandbox container: ${error}`);
    }
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
      } catch (error) {
        // Log but don't throw - cleanup should not fail the operation
        console.error(`Failed to stop sandbox container ${this.containerId}: ${error}`);
      }
      this.containerId = null;
    }
  }

  isInitialized(): boolean {
    return this.containerId !== null;
  }
}