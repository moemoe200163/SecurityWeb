import { prisma } from '../db/client.js';
import type { ToolTemplate } from '../types/rbac.js';

export class WhitelistValidator {
  private templateCache: Map<string, ToolTemplate> = new Map();
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  async getTemplate(templateId: string): Promise<ToolTemplate | null> {
    await this.refreshCacheIfNeeded();

    const cached = this.templateCache.get(templateId);
    if (cached && cached.is_approved) {
      return cached;
    }
    return null;
  }

  async getAllApprovedTemplates(): Promise<ToolTemplate[]> {
    await this.refreshCacheIfNeeded();
    return Array.from(this.templateCache.values());
  }

  async validateAndBuildCommand(
    templateId: string,
    params: Record<string, string>
  ): Promise<{ valid: boolean; command?: string[]; error?: string }> {
    const template = await this.getTemplate(templateId);

    if (!template) {
      return { valid: false, error: 'Template not found or not approved' };
    }

    // Validate parameters against allowed_params
    const validationResult = this.validateParams(template, params);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Build command from template
    const command = this.buildCommand(template, params);

    // Final whitelist validation - ensure command matches template exactly
    if (!this.isCommandWhitelisted(template, command)) {
      return { valid: false, error: 'Command does not match approved template' };
    }

    return { valid: true, command };
  }

  private validateParams(
    template: ToolTemplate,
    params: Record<string, string>
  ): { valid: boolean; error?: string } {
    const allowed = template.allowed_params || {};

    for (const [key, value] of Object.entries(params)) {
      if (!allowed[key]) {
        return { valid: false, error: `Parameter '${key}' is not allowed for this template` };
      }

      const allowedValues = allowed[key];
      if (allowedValues.length > 0 && !allowedValues.includes(value)) {
        return {
          valid: false,
          error: `Invalid value '${value}' for parameter '${key}'. Allowed: ${allowedValues.join(', ')}`,
        };
      }
    }

    return { valid: true };
  }

  private buildCommand(template: ToolTemplate, params: Record<string, string>): string[] {
    const parts = template.command_template.split(' ');

    return parts.map((part) => {
      const match = part.match(/^\{(\w+)\}$/);
      if (match && params[match[1]]) {
        return params[match[1]];
      }
      return part;
    });
  }

  private isCommandWhitelisted(template: ToolTemplate, command: string[]): boolean {
    const templateParts = template.command_template.split(' ');
    if (templateParts.length !== command.length) {
      return false;
    }

    for (let i = 0; i < templateParts.length; i++) {
      const expected = templateParts[i];
      const actual = command[i];

      if (expected.startsWith('{') && expected.endsWith('}')) {
        continue;
      }

      if (expected !== actual) {
        return false;
      }
    }

    return true;
  }

  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.cacheTime < this.CACHE_TTL && this.templateCache.size > 0) {
      return;
    }

    const templates = await prisma.toolTemplate.findMany({
      where: { isApproved: true }
    });

    this.templateCache.clear();
    for (const row of templates) {
      const mapped: ToolTemplate = {
        id: row.id,
        name: row.name,
        tool: row.tool,
        command_template: row.commandTemplate,
        allowed_params: row.allowedParams as Record<string, string[]>,
        created_by: row.createdBy,
        is_approved: row.isApproved,
        created_at: row.createdAt,
      };
      this.templateCache.set(row.id, mapped);
    }
    this.cacheTime = now;
  }
}