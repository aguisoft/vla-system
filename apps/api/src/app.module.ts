import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HookModule } from './core/hooks/hook.module';
import { PluginRegistryModule } from './core/plugin-registry/plugin-registry.module';
import { PluginLoaderModule } from './core/plugin-loader/plugin-loader.module';
import { RedisModule } from './core/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Core infrastructure — order matters: hooks before registry, registry before plugins
    PrismaModule,
    RedisModule,
    HookModule,
    AuthModule,
    UsersModule,
    PluginRegistryModule,
    // Dynamic external plugin loader (scans storage/plugins/ at boot)
    PluginLoaderModule.register(),
    // Built-in modules
    AdminModule,
  ],
})
export class AppModule {}
