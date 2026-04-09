import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Router } from 'express';
import type { PluginContext, PluginManifest } from '@vla/plugin-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';
import { RedisService } from '../redis/redis.service';
import { PluginRegistryService } from '../plugin-registry/plugin-registry.service';
import { BitrixService } from '../integrations/bitrix/bitrix.service';

@Injectable()
export class PluginContextFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: HookService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly registry: PluginRegistryService,
    private readonly bitrixService: BitrixService,
  ) {}

  /**
   * Builds the PluginContext object that is passed to a plugin's register() method.
   * The router must be created externally and mounted on the Express app before calling this.
   */
  build(manifest: PluginManifest, router: Router): PluginContext {
    const logger = new Logger(manifest.name);
    const { prisma, hooks, redis, jwtService, schedulerRegistry } = this;
    const pluginName = manifest.name;

    return {
      router,

      hooks: {
        registerAction: (hookName, handler, opts) =>
          hooks.registerAction(hookName, handler, { ...opts, pluginName }),
        registerFilter: (hookName, handler, opts) =>
          hooks.registerFilter(hookName, handler, { ...opts, pluginName }),
        doAction: (hookName, payload) => hooks.doAction(hookName, payload),
        applyFilter: (hookName, payload) => hooks.applyFilter(hookName, payload),
        declareHook: (hookName, metadata?) => hooks.declareHook(hookName, pluginName, metadata),
      },

      prisma,

      redis: {
        get: (key) => redis.get(`plugin:${pluginName}:${key}`),
        set: (key, value, ttl) => redis.set(`plugin:${pluginName}:${key}`, value, ttl),
        del: (key) => redis.del(`plugin:${pluginName}:${key}`),
        getJson: <T>(key: string) => redis.getJson<T>(`plugin:${pluginName}:${key}`),
        setJson: <T>(key: string, value: T, ttl?: number) =>
          redis.setJson<T>(`plugin:${pluginName}:${key}`, value, ttl),
      },

      logger: {
        log: (msg: string | object) => logger.log(msg),
        warn: (msg: string | object) => logger.warn(msg),
        error: (msg: string | object) => logger.error(msg),
        debug: (msg: string | object) => logger.debug(msg),
      },

      cron: (expression, handler) => {
        const jobName = `plugin:${pluginName}:${expression}`;
        const job = new CronJob(expression, handler, null, true, 'UTC');
        // Register so NestJS can list/stop it; ignore duplicate errors (idempotent on restart)
        try {
          schedulerRegistry.addCronJob(jobName, job as any);
        } catch {
          schedulerRegistry.deleteCronJob(jobName);
          schedulerRegistry.addCronJob(jobName, job as any);
        }
        logger.log(`Cron registered: "${expression}"`);
      },

      requireAuth: (role?) => {
        return (req: any, res: any, next: any) => {
          // Accept token from Authorization header OR vla_token cookie
          const authHeader: string | undefined = req.headers?.authorization;
          const cookieToken: string | undefined = req.cookies?.vla_token;
          const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : cookieToken;

          if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
          }
          try {
            const payload = jwtService.verify(token) as { sub: string; role: string; permissions: string[] };
            if (role && payload.role !== role) {
              return res.status(403).json({ message: 'Forbidden' });
            }
            req.user = payload;
            next();
          } catch {
            return res.status(401).json({ message: 'Invalid token' });
          }
        };
      },

      bitrix: this.bitrixService.isConfigured() ? {
        isConfigured: () => this.bitrixService.isConfigured(),
        call: <T>(method: string, params?: Record<string, unknown>) => this.bitrixService.call<T>(method, params),
        callRaw: <T>(method: string, params?: Record<string, unknown>) => this.bitrixService.callRaw<T>(method, params),
        callAll: <T>(method: string, params?: Record<string, unknown>) => this.bitrixService.callAll<T>(method, params),
      } : undefined,

      query: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
        const schema = `plugin_${pluginName.replace(/-/g, '_')}`;
        const fullSql = `SET search_path TO "${schema}", public; ${sql}`;
        const result = params?.length
          ? await prisma.$queryRawUnsafe(fullSql, ...params)
          : await prisma.$queryRawUnsafe(fullSql);
        await prisma.$executeRawUnsafe('SET search_path TO public');
        return result as T[];
      },

      requirePermission: (permission: string) => {
        return (req: any, res: any, next: any) => {
          if (req.user?.role === 'ADMIN') return next();
          const permissions: string[] = req.user?.permissions ?? [];
          if (!permissions.includes(permission)) {
            return res.status(403).json({ message: 'Forbidden', required: permission });
          }
          next();
        };
      },

      plugin: {
        name: pluginName,
        version: manifest.version,
        // Config is loaded asynchronously in PluginLoaderService after registry hydration
        config: {},
      },
    };
  }

  /** Hydrates ctx.plugin.config from the DB after the plugin has been registered */
  async hydrateConfig(ctx: PluginContext): Promise<void> {
    const record = await this.prisma.plugin.findUnique({
      where: { name: ctx.plugin.name },
      select: { config: true },
    });
    if (record?.config) {
      Object.assign(ctx.plugin.config, record.config as Record<string, unknown>);
    }
  }
}
