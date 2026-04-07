import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BitrixService {
  private readonly logger = new Logger(BitrixService.name);
  private readonly webhookUrl: string;

  constructor(private configService: ConfigService) {
    this.webhookUrl = this.configService.get('BITRIX_WEBHOOK_URL', '');
    this.logger.log(`BitrixService init — webhook configured: ${!!this.webhookUrl}`);
  }

  private async bitrixPost(method: string, body: Record<string, unknown>): Promise<any> {
    const url = `${this.webhookUrl}${method}`;
    // Use https module directly to avoid undici HTTP/2 negotiation issues
    const https = require('https');
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);

    const data = await new Promise<any>((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        servername: urlObj.hostname,
        ALPNProtocols: ['http/1.1'],
        agent: false, // Disable connection pooling to avoid stale connections
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Host': urlObj.hostname,
        },
      };
      const req = https.request(options, (res: any) => {
        let raw = '';
        res.on('data', (chunk: any) => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${method} | headers: ${JSON.stringify(res.headers)} | body: ${raw.slice(0,100)}`));
          } else {
            try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON response')); }
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(postData);
      req.end();
    });

    return data;
  }

  async openTimeman(bitrixUserId: number): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.warn('Bitrix webhook URL not configured, skipping timeman.open');
      return false;
    }
    try {
      await this.bitrixPost('timeman.open', { USER_ID: bitrixUserId });
      return true;
    } catch (error) {
      this.logger.error(`Failed to open timeman for user ${bitrixUserId}`, error);
      return false;
    }
  }

  async closeTimeman(bitrixUserId: number): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.warn('Bitrix webhook URL not configured, skipping timeman.close');
      return false;
    }
    try {
      await this.bitrixPost('timeman.close', { USER_ID: bitrixUserId });
      return true;
    } catch (error) {
      this.logger.error(`Failed to close timeman for user ${bitrixUserId}`, error);
      return false;
    }
  }

  /**
   * Get the active-today status for multiple Bitrix users via im.user.list.get.
   * Returns a map of bitrixUserId → wasActiveToday (bool).
   */
  async getBulkActiveStatus(bitrixUserIds: number[]): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();
    if (!this.webhookUrl || bitrixUserIds.length === 0) return result;

    const today = new Date().toISOString().slice(0, 10);
    try {
      const data = await this.bitrixPost('im.user.list.get', { id: bitrixUserIds });
      const users: Record<string, any> = data?.result ?? {};
      for (const [uid, info] of Object.entries(users)) {
        const lastActivity = (info.last_activity_date ?? '').slice(0, 10);
        result.set(Number(uid), lastActivity === today);
      }
    } catch (err: any) {
      this.logger.error('Failed to get bulk IM status from Bitrix24', err?.message);
    }
    return result;
  }

  /**
   * Query current timeman status for a user.
   * Returns STATUS and ACTIVE fields — EXPIRED+ACTIVE=true means the session
   * auto-expired but the user is still considered clocked in.
   */
  async getTimemanStatus(bitrixUserId: number): Promise<{ status: 'OPENED' | 'CLOSED' | 'EXPIRED' | 'PAUSED' | null; active: boolean }> {
    if (!this.webhookUrl) return { status: null, active: false };
    try {
      const data = await this.bitrixPost('timeman.status', { USER_ID: bitrixUserId });
      const result = data?.result ?? {};
      return {
        status: result.STATUS ?? null,
        active: result.ACTIVE === true || result.ACTIVE === 'true',
      };
    } catch (err: any) {
      this.logger.error(`getTimemanStatus failed for user ${bitrixUserId}: ${err?.message}`);
      return { status: null, active: false };
    }
  }

  /** Register VLA as an event handler in Bitrix24 for timeman events */
  async bindWebhookEvents(handlerUrl: string): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.warn('Bitrix webhook URL not configured, cannot bind events');
      return false;
    }
    const events = ['ONTIMEMANOPEN', 'ONTIMEMANCLOSE'];
    let allOk = true;
    for (const event of events) {
      try {
        await this.bitrixPost('event.bind', { event, handler: handlerUrl });
        this.logger.log(`Registered Bitrix event: ${event} → ${handlerUrl}`);
      } catch (error) {
        this.logger.error(`Failed to bind Bitrix event ${event}`, error);
        allOk = false;
      }
    }
    return allOk;
  }

  /** Debug: test timeman.status directly, returning raw result or error */
  async debugTimemanStatus(bitrixUserId: number): Promise<Record<string, unknown>> {
    if (!this.webhookUrl) return { webhookConfigured: false, error: 'No webhook URL' };
    const { spawn } = require('child_process');
    const url = `${this.webhookUrl}timeman.status`;
    const body = JSON.stringify({ USER_ID: bitrixUserId });
    // Use a child Node.js process to bypass any NestJS/undici interference
    const childResult = await new Promise<string>((resolve) => {
      const child = spawn('node', ['-e', `
        (async () => {
          try {
            const r = await fetch('${url}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '${body}',
            });
            const t = await r.text();
            console.log(JSON.stringify({ status: r.status, body: t.slice(0, 300) }));
          } catch(e) {
            console.log(JSON.stringify({ error: e.message }));
          }
        })();
      `]);
      let out = '';
      child.stdout.on('data', (d: any) => { out += d.toString(); });
      child.stderr.on('data', () => {});
      child.on('close', () => resolve(out.trim()));
    });

    try {
      const childParsed = JSON.parse(childResult);
      return { webhookConfigured: true, childProcess: childParsed };
    } catch {
      return { webhookConfigured: true, childResult };
    }
  }
}
