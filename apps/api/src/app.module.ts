import * as Joi from 'joi';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HookModule } from './core/hooks/hook.module';
import { PluginRegistryModule } from './core/plugin-registry/plugin-registry.module';
import { PluginLoaderModule } from './core/plugin-loader/plugin-loader.module';
import { RedisModule } from './core/redis/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { RolesModule } from './core/roles/roles.module';
import { PermissionsModule } from './core/permissions/permissions.module';

@Module({
  providers: [
    // Global rate-limit guard — individual routes can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
          : undefined,
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL:         Joi.string().required(),
        DIRECT_URL:           Joi.string().optional(),
        REDIS_HOST:           Joi.string().required(),
        REDIS_PORT:           Joi.number().default(6379),
        REDIS_PASSWORD:       Joi.string().optional().allow(''),
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
    // Custom roles & permissions
    RolesModule,
    PermissionsModule,
    // Built-in modules
    AdminModule,
  ],
})
export class AppModule {}
