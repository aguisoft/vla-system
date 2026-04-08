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

  // ── Permissions / Roles ──────────────────────────────────────────────────
  /**
   * Filter: extend the global permissions map.
   * Plugins add their own permissions here so they appear in the Roles UI.
   * Value: Record<string, { label: string; group: string; plugin?: string }>
   * Usage:  hooks.addFilter(CORE_HOOKS.PERMISSIONS_REGISTER, (map) => ({ ...map, 'my.perm': { label: '...', group: 'MyPlugin', plugin: 'my-plugin' } }))
   */
  PERMISSIONS_REGISTER: 'core.permissions.register',

  /**
   * Filter: extend the resolved permissions for a specific user at login time.
   * Plugins can inject extra permissions based on user context (e.g. external role mapping).
   * Value: { permissions: string[]; userId: string; role: string }
   * Usage:  hooks.registerFilter(CORE_HOOKS.PERMISSIONS_EXTEND, async (ctx) => ({ ...ctx, permissions: [...ctx.permissions, 'my.perm'] }))
   */
  PERMISSIONS_EXTEND: 'core.permissions.extend',

  /**
   * Filter: register preset roles that plugins ship with.
   * These appear in the Roles tab as "quick create" suggestions.
   * Value: Array<{ name: string; description?: string; permissions: string[]; color?: string; plugin: string }>
   * Usage:  hooks.addFilter(CORE_HOOKS.ROLES_PRESET, (roles) => [...roles, { name: 'Agent', permissions: ['my.perm'], plugin: 'my-plugin' }])
   */
  ROLES_PRESET: 'core.roles.preset',
} as const;

export type CoreHookName = (typeof CORE_HOOKS)[keyof typeof CORE_HOOKS];
