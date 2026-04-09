import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Router } from 'express';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { HttpAdapterHost } from '@nestjs/core';
import type { DiscoveredPlugin } from './plugin-discovery';
import type { PluginManifest, CoreIntegration } from '@vla/plugin-sdk';
import { DISCOVERED_PLUGINS_TOKEN } from './plugin-loader.constants';
import { PluginContextFactory } from './plugin-context.factory';
import { PluginRegistryService } from '../plugin-registry/plugin-registry.service';
import { BitrixService } from '../integrations/bitrix/bitrix.service';
import { PluginMigrationService } from './plugin-migration.service';

@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);

  constructor(
    @Inject(DISCOVERED_PLUGINS_TOKEN) private readonly discovered: DiscoveredPlugin[],
    private readonly contextFactory: PluginContextFactory,
    private readonly registry: PluginRegistryService,
    private readonly adapterHost: HttpAdapterHost,
    private readonly bitrixService: BitrixService,
    private readonly migrationService: PluginMigrationService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.discovered.length === 0) return;

    const httpAdapter = this.adapterHost.httpAdapter;
    const expressApp = httpAdapter.getInstance();

    for (const { manifest, definition, pluginDir } of this.discovered) {
      try {
        const uiDir = path.join(pluginDir, 'ui');
        const hasFrontend = fs.existsSync(uiDir);

        // Check integration requirements declared in plugin.json
        const unmet = this.checkRequirements(manifest);
        if (unmet.length > 0) {
          this.logger.warn(
            `Plugin "${manifest.name}" has unmet requirements: ${unmet.join(', ')} — loaded in degraded mode`,
          );
          await this.registry.register({
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
            route: manifest.route,
            icon: manifest.icon,
            adminOnly: manifest.adminOnly,
            hasFrontend,
            accessPermissions: manifest.accessPermissions ?? [],
            settingsSchema: manifest.settings,
            unmetRequirements: unmet,
          });
          continue; // Skip register() — plugin cannot function without its requirements
        }

        const pluginRouter = Router();
        const ctx = this.contextFactory.build(manifest, pluginRouter);

        await definition.register(ctx);

        await this.registry.register({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          route: manifest.route,
          icon: manifest.icon,
          adminOnly: manifest.adminOnly,
          hasFrontend,
          accessPermissions: manifest.accessPermissions ?? [],
          settingsSchema: manifest.settings,
          onInstall: definition.onInstall?.bind(definition),
          onActivate: undefined,
          onDeactivate: definition.onDeactivate?.bind(definition),
        });

        await this.contextFactory.hydrateConfig(ctx);

        // Run pending database migrations for this plugin
        try {
          await this.migrationService.runPending(manifest.name, pluginDir);
        } catch (err) {
          this.logger.error(`Plugin "${manifest.name}" migration failed — plugin may not function correctly`);
        }

        // Error handler: catch unhandled errors in plugin routes so they don't crash the API
        pluginRouter.use((err: any, _req: any, res: any, _next: any) => {
          this.logger.error(`Plugin "${manifest.name}" route error: ${err?.message ?? err}`);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Plugin error', plugin: manifest.name, error: err?.message });
          }
        });

        const mountPath = `/api/v1/p/${manifest.name}`;
        expressApp.use(mountPath, pluginRouter);

        if (hasFrontend) {
          expressApp.use(`${mountPath}/ui`, express.static(uiDir));
          this.logger.log(`Plugin frontend served at ${mountPath}/ui: ${manifest.name}`);
        }

        this.logger.log(`Plugin loaded and mounted at ${mountPath}: ${manifest.name} v${manifest.version}`);
      } catch (err) {
        this.logger.error(
          `Failed to initialize plugin "${manifest.name}": ` +
            (err instanceof Error ? err.stack : String(err)),
        );
      }
    }
  }

  private checkRequirements(manifest: PluginManifest): string[] {
    const unmet: string[] = [];
    for (const req of (manifest.requires ?? []) as CoreIntegration[]) {
      switch (req) {
        case 'bitrix':
          if (!this.bitrixService.isConfigured()) unmet.push('bitrix');
          break;
        default:
          unmet.push(req);
      }
    }
    return unmet;
  }
}
