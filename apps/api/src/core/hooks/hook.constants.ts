/**
 * Core hook names emitted by the VLA system kernel.
 * Plugins can listen to these with HookService.onAction() / onFilter().
 */
export const CORE_HOOKS = {
  // ── User ────────────────────────────────────────────────────────────────
  /** Fired after a new user is created. Payload: { user } */
  USER_CREATED: 'core.user.created',
  /** Fired after a user is updated. Payload: { userId, changes } */
  USER_UPDATED: 'core.user.updated',
  /** Filter: transform the user object before it is returned by GET /users/:id */
  USER_SERIALIZE: 'core.user.serialize',

  // ── Auth ────────────────────────────────────────────────────────────────
  /** Fired after a successful login. Payload: { user, token } */
  AUTH_LOGIN: 'core.auth.login',
  /** Fired after a Google OAuth login/registration. Payload: { user, isNew } */
  AUTH_GOOGLE_LOGIN: 'core.auth.google_login',

  // ── Plugin lifecycle ─────────────────────────────────────────────────────
  /** Fired after a plugin is activated. Payload: { pluginName } */
  PLUGIN_ACTIVATED: 'core.plugin.activated',
  /** Fired after a plugin is deactivated. Payload: { pluginName } */
  PLUGIN_DEACTIVATED: 'core.plugin.deactivated',
} as const;

export type CoreHookName = (typeof CORE_HOOKS)[keyof typeof CORE_HOOKS];
