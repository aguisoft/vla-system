import { DynamicModule, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { discoverPlugins, DiscoveredPlugin } from './plugin-discovery';
import { DISCOVERED_PLUGINS_TOKEN } from './plugin-loader.constants';
import { PluginContextFactory } from './plugin-context.factory';
import { PluginLoaderService } from './plugin-loader.service';
import { PluginMigrationService } from './plugin-migration.service';

/**
 * Dynamic module that:
 *  1. Scans storage/plugins/ synchronously at module creation time.
 *  2. Provides PluginContextFactory and PluginLoaderService.
 *  3. PluginLoaderService.onModuleInit() calls register() on every discovered plugin.
 */
@Module({})
export class PluginLoaderModule {
  static register(): DynamicModule {
    const discovered: DiscoveredPlugin[] = discoverPlugins();

    return {
      module: PluginLoaderModule,
      imports: [
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: process.env.JWT_SECRET!,
            signOptions: { expiresIn: '7d' },
          }),
        }),
      ],
      providers: [
        {
          provide: DISCOVERED_PLUGINS_TOKEN,
          useValue: discovered,
        },
        PluginContextFactory,
        PluginMigrationService,
        PluginLoaderService,
      ],
      exports: [],
    };
  }
}
