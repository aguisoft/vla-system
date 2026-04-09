import { Module, Global } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginRegistryController } from './plugin-registry.controller';
import { PluginUploadService } from '../plugin-loader/plugin-upload.service';
import { PluginMigrationService } from '../plugin-loader/plugin-migration.service';
import { PluginVersionService } from '../plugin-loader/plugin-version.service';
import { PluginDependencyService } from '../plugin-loader/plugin-dependency.service';

@Global()
@Module({
  controllers: [PluginRegistryController],
  providers: [PluginRegistryService, PluginUploadService, PluginMigrationService, PluginVersionService, PluginDependencyService],
  exports: [PluginRegistryService, PluginUploadService, PluginMigrationService, PluginVersionService, PluginDependencyService],
})
export class PluginRegistryModule {}
