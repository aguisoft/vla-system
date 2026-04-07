/**
 * Shared hook name constants.
 *
 * These strings must stay in sync with
 * `apps/api/src/core/hooks/hook.constants.ts`.
 * They are re-exported here so frontend code can reference them
 * without importing backend modules.
 */
export const VLA_HOOKS = {
  // ── Core / User ──────────────────────────────────────────────────────────
  USER_CREATED: 'core.user.created',
  USER_UPDATED: 'core.user.updated',
  USER_SERIALIZE: 'core.user.serialize',

  // ── Core / Auth ───────────────────────────────────────────────────────────
  AUTH_LOGIN: 'core.auth.login',
  AUTH_GOOGLE_LOGIN: 'core.auth.google_login',

  // ── Core / Plugin lifecycle ───────────────────────────────────────────────
  PLUGIN_ACTIVATED: 'core.plugin.activated',
  PLUGIN_DEACTIVATED: 'core.plugin.deactivated',

  // ── Office plugin ─────────────────────────────────────────────────────────
  OFFICE_USER_CHECKED_IN: 'office.user.checked_in',
  OFFICE_USER_CHECKED_OUT: 'office.user.checked_out',
  OFFICE_USER_STATUS_CHANGED: 'office.user.status_changed',
  OFFICE_USER_MOVED: 'office.user.moved',
} as const;

export type VlaHookName = (typeof VLA_HOOKS)[keyof typeof VLA_HOOKS];
