import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { BitrixAppConfig, BitrixTokens, BitrixCallResult, BitrixClientInterface } from './bitrix.types';

const SETTING_APP = 'bitrix.app';
const SETTING_TOKENS = 'bitrix.tokens';
const RATE_KEY = 'core:bitrix:ratelimit';
const MAX_RPS = 2; // Bitrix allows ~2 req/s per OAuth app

@Injectable()
export class BitrixService implements OnModuleInit, BitrixClientInterface {
  private readonly logger = new Logger(BitrixService.name);
  private appConfig: BitrixAppConfig | null = null;
  private tokens: BitrixTokens | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadFromDb();
    if (this.appConfig) {
      this.logger.log(`Bitrix24 OAuth2 configured for ${this.appConfig.domain}`);
    } else {
      this.logger.warn('Bitrix24 no configurado — los plugins que lo requieran estarán en modo degradado');
    }
  }

  // ── Public API (BitrixClientInterface) ──────────────────────────────────────

  isConfigured(): boolean {
    return !!(this.appConfig && this.tokens);
  }

  getStatus(): { configured: boolean; domain?: string; tokenValid?: boolean; expiresAt?: number } {
    return {
      configured: this.isConfigured(),
      domain: this.appConfig?.domain,
      tokenValid: this.tokens ? this.tokens.expiresAt > Date.now() : undefined,
      expiresAt: this.tokens?.expiresAt,
    };
  }

  async call<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const raw = await this.callRaw<T>(method, params);
    return raw.result;
  }

  async callRaw<T = any>(method: string, params: Record<string, unknown> = {}): Promise<BitrixCallResult<T>> {
    await this.ensureValidToken();
    await this.rateLimit();

    const url = `https://${this.appConfig!.domain}/rest/${method}.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tokens!.accessToken}`,
      },
      body: JSON.stringify(params),
    });

    const data = await res.json() as any;

    // Handle expired token — refresh and retry once
    if (data.error === 'expired_token' || data.error === 'WRONG_TOKEN') {
      this.logger.warn(`Token expired calling ${method}, refreshing...`);
      await this.refreshAccessToken();
      return this.callRawDirect<T>(method, params);
    }

    if (!res.ok || data.error) {
      const errMsg = `[${method}] ${data.error ?? res.status}: ${data.error_description ?? ''}`;
      throw new Error(errMsg);
    }

    return { result: data.result, next: data.next, total: data.total };
  }

  async callAll<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T[]> {
    const items: T[] = [];
    let start = 0;

    while (true) {
      const raw = await this.callRaw<T[]>(method, { ...params, start });
      const page = raw.result ?? [];
      items.push(...page);
      if (!raw.next) break;
      start = raw.next;
    }

    return items;
  }

  // ── OAuth2 flow ─────────────────────────────────────────────────────────────

  async saveAppConfig(config: BitrixAppConfig): Promise<void> {
    this.appConfig = config;
    await this.prisma.systemSetting.upsert({
      where: { key: SETTING_APP },
      create: { key: SETTING_APP, value: config as any },
      update: { value: config as any },
    });
    this.logger.log(`Bitrix app config saved for domain ${config.domain}`);
  }

  getAuthorizeUrl(redirectUri: string): string {
    if (!this.appConfig) throw new Error('Bitrix app not configured');
    return (
      `https://${this.appConfig.domain}/oauth/authorize/` +
      `?client_id=${this.appConfig.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`
    );
  }

  async handleOAuthCallback(code: string, redirectUri: string): Promise<void> {
    if (!this.appConfig) throw new Error('Bitrix app not configured');

    const tokenUrl =
      `https://oauth.bitrix.info/oauth/token/` +
      `?grant_type=authorization_code` +
      `&client_id=${this.appConfig.clientId}` +
      `&client_secret=${this.appConfig.clientSecret}` +
      `&code=${code}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const res = await fetch(tokenUrl);
    const data = await res.json() as any;

    if (data.error) {
      throw new Error(`OAuth error: ${data.error} — ${data.error_description ?? ''}`);
    }

    await this.saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });

    this.logger.log('Bitrix OAuth2 tokens obtained successfully');
  }

  async disconnect(): Promise<void> {
    this.tokens = null;
    await this.prisma.systemSetting.deleteMany({ where: { key: { in: [SETTING_APP, SETTING_TOKENS] } } });
    this.appConfig = null;
    this.logger.log('Bitrix integration disconnected');
  }

  /** Reload config from DB (useful after external changes) */
  async reload(): Promise<void> {
    await this.loadFromDb();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async loadFromDb(): Promise<void> {
    const [appRow, tokensRow] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: SETTING_APP } }),
      this.prisma.systemSetting.findUnique({ where: { key: SETTING_TOKENS } }),
    ]);
    this.appConfig = appRow ? (appRow.value as unknown as BitrixAppConfig) : null;
    this.tokens = tokensRow ? (tokensRow.value as unknown as BitrixTokens) : null;
  }

  private async saveTokens(tokens: BitrixTokens): Promise<void> {
    this.tokens = tokens;
    await this.prisma.systemSetting.upsert({
      where: { key: SETTING_TOKENS },
      create: { key: SETTING_TOKENS, value: tokens as any },
      update: { value: tokens as any },
    });
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.appConfig || !this.tokens) {
      throw new Error('Bitrix24 no configurado. Configure la integración en Administración → Integraciones.');
    }
    // Refresh if within 60s of expiry
    if (this.tokens.expiresAt - Date.now() < 60_000) {
      await this.refreshAccessToken();
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.appConfig || !this.tokens?.refreshToken) {
      throw new Error('Cannot refresh: no refresh token available');
    }

    const url =
      `https://oauth.bitrix.info/oauth/token/` +
      `?grant_type=refresh_token` +
      `&client_id=${this.appConfig.clientId}` +
      `&client_secret=${this.appConfig.clientSecret}` +
      `&refresh_token=${this.tokens.refreshToken}`;

    const res = await fetch(url);
    const data = await res.json() as any;

    if (data.error) {
      this.logger.error(`Token refresh failed: ${data.error} — ${data.error_description ?? ''}`);
      throw new Error(`Token refresh failed: ${data.error}`);
    }

    await this.saveTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });

    this.logger.log('Bitrix access token refreshed');
  }

  /** Direct call without token validation (used after refresh to avoid recursion) */
  private async callRawDirect<T>(method: string, params: Record<string, unknown>): Promise<BitrixCallResult<T>> {
    await this.rateLimit();
    const url = `https://${this.appConfig!.domain}/rest/${method}.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.tokens!.accessToken}`,
      },
      body: JSON.stringify(params),
    });

    const data = await res.json() as any;
    if (!res.ok || data.error) {
      throw new Error(`[${method}] ${data.error ?? res.status}: ${data.error_description ?? ''}`);
    }
    return { result: data.result, next: data.next, total: data.total };
  }

  /** Simple rate limiter: max MAX_RPS requests per second via Redis counter */
  private async rateLimit(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const key = `${RATE_KEY}:${now}`;
    const raw = await this.redis.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= MAX_RPS) {
      const delay = 1000 - (Date.now() % 1000);
      await new Promise(r => setTimeout(r, delay));
    }
    await this.redis.set(key, String(count + 1), 2);
  }
}
