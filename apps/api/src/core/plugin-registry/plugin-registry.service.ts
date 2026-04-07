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
  async register(plugin: VLAPlugin): Promise<void> {
    this.plugins.set(plugin.name, plugin);

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
    const record = await this.prisma.plugin.update({
      where: { name },
      // Prisma InputJsonValue requires a cast for generic objects
      data: { config: config as any },
    });
    return this.toRegistration(record);
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
