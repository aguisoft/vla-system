import { Module, OnModuleInit } from '@nestjs/common';
import { PluginRegistryService } from '../../core/plugin-registry/plugin-registry.service';
import { UsersModule } from '../../core/users/users.module';

@Module({
  imports: [UsersModule],
})
export class AdminModule implements OnModuleInit {
  constructor(private readonly pluginRegistry: PluginRegistryService) {}

  async onModuleInit(): Promise<void> {
    await this.pluginRegistry.register({
      name: 'admin',
      version: '1.0.0',
      description: 'Panel de administración del sistema',
      route: '/dashboard/admin',
      icon: 'settings',
      adminOnly: true,
    });
  }
}
