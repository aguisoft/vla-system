import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
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
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL:         Joi.string().required(),
        REDIS_HOST:           Joi.string().required(),
        REDIS_PORT:           Joi.number().default(6379),
        JWT_SECRET:           Joi.string().min(32).required(),
        JWT_EXPIRES_IN:       Joi.string().default('7d'),
        API_PORT:             Joi.number().default(3001),
        NODE_ENV:             Joi.string().valid('development', 'production', 'test').default('development'),
        FRONTEND_URL:         Joi.string().uri().required(),
        GOOGLE_CLIENT_ID:     Joi.string().optional().allow(''),
        GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
        GOOGLE_CALLBACK_URL:  Joi.string().uri().optional().allow(''),
      }),
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
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
