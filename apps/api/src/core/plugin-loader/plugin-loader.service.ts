import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Router } from 'express';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { HttpAdapterHost } from '@nestjs/core';
import type { DiscoveredPlugin } from './plugin-discovery';
import { DISCOVERED_PLUGINS_TOKEN } from './plugin-loader.constants';
import { PluginContextFactory } from './plugin-context.factory';
import { PluginRegistryService } from '../plugin-registry/plugin-registry.service';

/**
 * Receives the list of discovered plugins (injected via DISCOVERED_PLUGINS_TOKEN),
 * builds their PluginContext, calls register(), and mounts their routers
 * on /api/v1/p/:pluginName/.
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private readonly logger = new Logger(PluginLoaderService.name);

  constructor(
    @Inject(DISCOVERED_PLUGINS_TOKEN) private readonly discovered: DiscoveredPlugin[],
    private readonly contextFactory: PluginContextFactory,
    private readonly registry: PluginRegistryService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.discovered.length === 0) return;

    // Grab the underlying Express app so we can mount sub-routers
    const httpAdapter = this.adapterHost.httpAdapter;
    const expressApp = httpAdapter.getInstance();

    for (const { manifest, definition, pluginDir } of this.discovered) {
      try {
        const pluginRouter = Router();
        const ctx = this.contextFactory.build(manifest, pluginRouter);

        // Call the plugin's register() — it wires its routes and hooks here
        await definition.register(ctx);

        // Check if plugin ships a frontend bundle (ui/ folder inside its dir)
        const uiDir = path.join(pluginDir, 'ui');
        const hasFrontend = fs.existsSync(uiDir);

        // Upsert the plugin record in the DB and run install/activate lifecycle
        await this.registry.register({
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          route: manifest.route,
          icon: manifest.icon,
          adminOnly: manifest.adminOnly,
          hasFrontend,
          onInstall: definition.onInstall?.bind(definition),
          onActivate: undefined, // external plugins activate via register()
          onDeactivate: definition.onDeactivate?.bind(definition),
        });

        // Hydrate config into ctx.plugin.config after DB record exists
        await this.contextFactory.hydrateConfig(ctx);

        // Mount plugin router at /api/v1/p/:pluginName/
        const mountPath = `/api/v1/p/${manifest.name}`;
        expressApp.use(mountPath, pluginRouter);

        // Serve bundled frontend at /api/v1/p/:pluginName/ui/ if it exists
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
}
