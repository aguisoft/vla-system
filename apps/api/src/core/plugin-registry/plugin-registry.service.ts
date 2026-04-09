import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { VLAPlugin, PluginRegistration } from '@vla/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';
import { CORE_HOOKS } from '../hooks/hook.constants';

@Injectable()
export class PluginRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistryService.name);

  /** In-memory map of live plugin definitions (populated at boot via register()) */
  private readonly plugins = new Map<string, VLAPlugin>();

  /** In-memory map of which plugins have a bundled frontend */
  private readonly frontendFlags = new Map<string, boolean>();

  /** In-memory map of access permissions declared in each plugin's manifest */
  private readonly accessPermissionsMap = new Map<string, string[]>();

  /** In-memory map of unmet requirements per plugin */
  private readonly unmetRequirementsMap = new Map<string, string[]>();

  /** In-memory map of declarative settings schemas per plugin */
  private readonly settingsSchemas = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: HookService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Nothing to do here; plugins self-register via register().
    // This hook is a good place to add validation in the future
    // (e.g. mark missing plugins as inactive in DB).
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Called by each plugin module during `onModuleInit()`.
   * Upserts the plugin record in the DB and invokes lifecycle callbacks.
   */
  async register(plugin: VLAPlugin & { hasFrontend?: boolean; unmetRequirements?: string[]; settingsSchema?: any }): Promise<void> {
    this.plugins.set(plugin.name, plugin);
    this.frontendFlags.set(plugin.name, plugin.hasFrontend ?? false);
    this.accessPermissionsMap.set(plugin.name, (plugin as any).accessPermissions ?? []);
    if (plugin.settingsSchema) this.settingsSchemas.set(plugin.name, plugin.settingsSchema);
    if (plugin.unmetRequirements?.length) {
      this.unmetRequirementsMap.set(plugin.name, plugin.unmetRequirements);
    } else {
      this.unmetRequirementsMap.delete(plugin.name);
    }

    const existing = await this.prisma.plugin.findUnique({
      where: { name: plugin.name },
    });

    if (!existing) {
      await this.prisma.plugin.create({
        data: {
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          route: plugin.route ?? null,
          icon: plugin.icon ?? null,
          adminOnly: plugin.adminOnly ?? false,
          isActive: true,
        },
      });

      this.logger.log(`Plugin installed: ${plugin.name} v${plugin.version}`);

      if (plugin.onInstall) {
        await this.safeCall(plugin.name, 'onInstall', plugin.onInstall);
      }
      if (plugin.onActivate) {
        await this.safeCall(plugin.name, 'onActivate', plugin.onActivate);
      }
    } else {
      // Update metadata but respect the stored isActive flag
      await this.prisma.plugin.update({
        where: { name: plugin.name },
        data: {
          version: plugin.version,
          description: plugin.description,
          route: plugin.route ?? null,
          icon: plugin.icon ?? null,
          adminOnly: plugin.adminOnly ?? false,
        },
      });

      if (existing.isActive && plugin.onActivate) {
        await this.safeCall(plugin.name, 'onActivate', plugin.onActivate);
      }

      this.logger.log(
        `Plugin loaded: ${plugin.name} v${plugin.version} (active=${existing.isActive})`,
      );
    }
  }

  // ─── Lifecycle management ─────────────────────────────────────────────────

  async activate(name: string): Promise<PluginRegistration> {
    const record = await this.prisma.plugin.update({
      where: { name },
      data: { isActive: true },
    });

    const plugin = this.plugins.get(name);
    if (plugin?.onActivate) {
      await this.safeCall(name, 'onActivate', plugin.onActivate);
    }

    await this.hooks.doAction(CORE_HOOKS.PLUGIN_ACTIVATED, { pluginName: name });
    this.logger.log(`Plugin activated: ${name}`);
    return this.toRegistration(record);
  }

  async deactivate(name: string): Promise<PluginRegistration> {
    const record = await this.prisma.plugin.update({
      where: { name },
      data: { isActive: false },
    });

    const plugin = this.plugins.get(name);
    if (plugin?.onDeactivate) {
      await this.safeCall(name, 'onDeactivate', plugin.onDeactivate);
    }

    await this.hooks.doAction(CORE_HOOKS.PLUGIN_DEACTIVATED, { pluginName: name });
    this.logger.log(`Plugin deactivated: ${name}`);
    return this.toRegistration(record);
  }

  async updateConfig(name: string, config: Record<string, unknown>): Promise<PluginRegistration> {
    // Validate against schema if available
    const schema = this.settingsSchemas.get(name);
    if (schema) {
      const errors = this.validateConfig(schema, config);
      if (errors.length > 0) {
        throw new Error(`Config validation failed: ${errors.join('; ')}`);
      }
    }
    const record = await this.prisma.plugin.update({
      where: { name },
      data: { config: config as any },
    });
    return this.toRegistration(record);
  }

  getSettingsSchema(name: string): any | null {
    return this.settingsSchemas.get(name) ?? null;
  }

  private validateConfig(schema: any, config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const fields: any[] = [
      ...(schema.fields ?? []),
      ...(schema.sections ?? []).flatMap((s: any) => s.fields ?? []),
    ];
    for (const field of fields) {
      const val = config[field.key];
      if (field.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field.label} es requerido`);
        continue;
      }
      if (val === undefined || val === null) continue;
      if (field.type === 'number' && typeof val !== 'number') {
        errors.push(`${field.label} debe ser un número`);
      }
      if (field.type === 'boolean' && typeof val !== 'boolean') {
        errors.push(`${field.label} debe ser verdadero/falso`);
      }
      if (field.type === 'url' && typeof val === 'string' && !val.startsWith('http')) {
        errors.push(`${field.label} debe ser una URL válida`);
      }
      if (field.type === 'select' && field.options) {
        const valid = field.options.map((o: any) => o.value);
        if (!valid.includes(val)) errors.push(`${field.label}: valor no válido`);
      }
    }
    return errors;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  async getAll(): Promise<PluginRegistration[]> {
    const records = await this.prisma.plugin.findMany({
      orderBy: { installedAt: 'asc' },
    });
    return records.map((r) => this.toRegistration(r));
  }

  async getActive(): Promise<PluginRegistration[]> {
    const records = await this.prisma.plugin.findMany({
      where: { isActive: true },
      orderBy: { installedAt: 'asc' },
    });
    return records.map((r) => this.toRegistration(r));
  }

  async isActive(name: string): Promise<boolean> {
    const record = await this.prisma.plugin.findUnique({ where: { name } });
    return record?.isActive ?? false;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private toRegistration(record: {
    name: string;
    version: string;
    description: string;
    route: string | null;
    icon: string | null;
    adminOnly: boolean;
    isActive: boolean;
    config: unknown;
    installedAt: Date;
    updatedAt: Date;
  }): PluginRegistration {
    return {
      name: record.name,
      version: record.version,
      description: record.description,
      route: record.route ?? undefined,
      icon: record.icon ?? undefined,
      adminOnly: record.adminOnly,
      isActive: record.isActive,
      hasFrontend: this.frontendFlags.get(record.name) ?? false,
      accessPermissions: this.accessPermissionsMap.get(record.name) ?? [],
      unmetRequirements: this.unmetRequirementsMap.get(record.name) ?? [],
      hasSettings: this.settingsSchemas.has(record.name),
      config: (record.config as Record<string, unknown>) ?? null,
      installedAt: record.installedAt,
      updatedAt: record.updatedAt,
    };
  }

  private async safeCall(
    pluginName: string,
    method: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `Plugin "${pluginName}" threw in ${method}:`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
