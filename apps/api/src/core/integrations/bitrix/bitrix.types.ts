/** Stored in SystemSetting key = 'bitrix.app' */
export interface BitrixAppConfig {
  clientId: string;
  clientSecret: string;
  /** e.g. "grupovla.bitrix24.com" */
  domain: string;
}

/** Stored in SystemSetting key = 'bitrix.tokens' */
export interface BitrixTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (ms) when the access token expires */
  expiresAt: number;
}

/** Full Bitrix API response envelope */
export interface BitrixCallResult<T> {
  result: T;
  next?: number;
  total?: number;
}

/** Interface exposed to plugins via ctx.bitrix */
export interface BitrixClientInterface {
  /** Returns true if Bitrix24 OAuth2 is configured and tokens are valid */
  isConfigured(): boolean;
  /** Generic API call. Handles token refresh and rate limiting automatically. */
  call<T = any>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** Like call() but returns the full Bitrix response envelope */
  callRaw<T = any>(method: string, params?: Record<string, unknown>): Promise<BitrixCallResult<T>>;
  /** Auto-paginating call that follows the `next` cursor */
  callAll<T = any>(method: string, params?: Record<string, unknown>): Promise<T[]>;
}
