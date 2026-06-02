import { prisma } from '../db/client.js';
import type { ToolTemplate } from '../types/rbac.js';

export class WhitelistValidator {
  private templateCache: Map<string, ToolTemplate> = new Map();
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Required params are the placeholder names in `command_template`
   * (e.g. `nmap -sT {target}` requires `target`). This is derived at
   * validation time so the whitelist stays declarative.
   */
  private getRequiredParams(commandTemplate: string): string[] {
    const matches = commandTemplate.matchAll(/\{(\w+)\}/g);
    return Array.from(new Set(Array.from(matches, m => m[1])));
  }

  async getTemplate(templateId: string): Promise<ToolTemplate | null> {
    await this.refreshCacheIfNeeded();

    const cached = this.templateCache.get(templateId);
    // Must be BOTH approved and enabled. Disabled templates are reachable by
    // id from the DB but must not be eligible for execution.
    if (cached && cached.is_approved && cached.is_enabled !== false) {
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
      return {
        valid: false,
        error: 'Template not found, not approved, or disabled',
      };
    }

    // 1. Required params: every {placeholder} in command_template must be
    //    supplied by the caller.
    const required = this.getRequiredParams(template.command_template);
    for (const name of required) {
      if (!params[name] || params[name].trim() === '') {
        return {
          valid: false,
          error: `Missing required parameter '${name}'`,
        };
      }
    }

    // 2. Allowed params: every supplied key must be in allowed_params.
    //    Values are constrained to allowed_values when the list is non-empty.
    const paramResult = this.validateParams(template, params);
    if (!paramResult.valid) {
      return paramResult;
    }

    // 3. Build the executable command array from the template.
    const command = this.buildCommand(template, params);

    // 4. Final sanity check: produced command must match the template's
    //    placeholders, no extras, no missing.
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
      if (!(key in allowed)) {
        return {
          valid: false,
          error: `Parameter '${key}' is not allowed for this template`,
        };
      }

      const allowedValues = allowed[key];
      if (Array.isArray(allowedValues) && allowedValues.length > 0 && !allowedValues.includes(value)) {
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

    // Only approved AND enabled templates are eligible for execution. Disabled
    // templates must not be returned by the validator even if the caller
    // supplies the correct id.
    const templates = await prisma.toolTemplate.findMany({
      where: { isApproved: true, isEnabled: true },
    });

    this.templateCache.clear();
    for (const row of templates) {
      const mapped: ToolTemplate = {
        id: row.id,
        name: row.name,
        tool: row.tool,
        command_template: row.commandTemplate,
        allowed_params: (row.allowedParams ?? {}) as Record<string, string[]>,
        created_by: row.createdBy,
        is_approved: row.isApproved,
        is_enabled: row.isEnabled,
        created_at: row.createdAt,
      };
      this.templateCache.set(row.id, mapped);
    }
    this.cacheTime = now;
  }
}
