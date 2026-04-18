import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly hooks: HookService,
  ) {}

  onModuleInit() {
    const publicKey  = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject    = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
      this.logger.log('Web Push initialized');
    } else {
      this.logger.warn('VAPID keys not set — push notifications disabled');
    }

    this.hooks.registerAction(
      'dashboards.new_leads',
      async (payload: { count: number; newLeads: number }) => {
        await this.sendToAdmins({
          title: `${payload.newLeads} lead${payload.newLeads === 1 ? '' : 's'} nuevo${payload.newLeads === 1 ? '' : 's'}`,
          body:  `Total del mes: ${payload.count} leads`,
          url:   '/dashboard/dashboards',
        });
      },
    );
  }

  async subscribe(userId: string, endpoint: string, p256dh: string, auth: string): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where:  { endpoint },
      create: { userId, endpoint, p256dh, auth },
      update: { userId, p256dh, auth },
    });
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async unsubscribeForUser(endpoint: string, userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await this.sendToSubscriptions(subs, payload);
  }

  async sendToAdmins(payload: PushPayload): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    await Promise.all(admins.map((a) => this.sendToUser(a.id, payload)));
  }

  async sendToAll(payload: PushPayload): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany();
    await this.sendToSubscriptions(subs, payload);
  }

  private async sendToSubscriptions(
    subs: Array<{ endpoint: string; p256dh: string; auth: string }>,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.enabled || subs.length === 0) return;

    const notification = JSON.stringify({
      title: payload.title,
      body:  payload.body,
      icon:  payload.icon ?? '/icons/icon-192.png',
      url:   payload.url  ?? '/dashboard',
    });

    const stale: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            notification,
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            stale.push(sub.endpoint);
          } else {
            this.logger.warn(`Push send error for ${sub.endpoint}: ${err?.message}`);
          }
        }
      }),
    );

    if (stale.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: stale } },
      });
      this.logger.log(`Removed ${stale.length} stale push subscription(s)`);
    }
  }
}
