import { Module, Global } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginRegistryController } from './plugin-registry.controller';
import { PluginUploadService } from '../plugin-loader/plugin-upload.service';

@Global()
@Module({
  controllers: [PluginRegistryController],
  providers: [PluginRegistryService, PluginUploadService],
  exports: [PluginRegistryService, PluginUploadService],
})
export class PluginRegistryModule {}
