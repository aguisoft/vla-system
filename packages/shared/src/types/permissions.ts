export const PERMISSIONS = {
  // ── Users ──────────────────────────────────────────────────────────────────
  USERS_READ:        'users.read',
  USERS_CREATE:      'users.create',
  USERS_UPDATE:      'users.update',
  USERS_DELETE:      'users.delete',
  USERS_IMPERSONATE: 'users.impersonate',

  // ── Roles ──────────────────────────────────────────────────────────────────
  ROLES_MANAGE: 'roles.manage',

  // ── Plugins / Modules ──────────────────────────────────────────────────────
  PLUGINS_READ:   'plugins.read',
  PLUGINS_MANAGE: 'plugins.manage',

  // ── Virtual Office (registered dynamically by office plugin) ────────────────
  OFFICE_VIEW:    'office.view',
  OFFICE_CHECKIN: 'office.checkin',
  OFFICE_MANAGE:  'office.manage',

  // ── Academy ────────────────────────────────────────────────────────────────
  ACADEMY_READ:   'academy.read',
  ACADEMY_MANAGE: 'academy.manage',

  // ── Reports ────────────────────────────────────────────────────────────────
  REPORTS_READ: 'reports.read',

  // ── System ─────────────────────────────────────────────────────────────────
  SYSTEM_ADMIN: 'system.admin',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Human-readable labels for every permission, grouped by category */
export const PERMISSION_META: Record<Permission, { label: string; group: string }> = {
  'users.read':        { label: 'Ver usuarios',          group: 'Usuarios' },
  'users.create':      { label: 'Crear usuarios',        group: 'Usuarios' },
  'users.update':      { label: 'Editar usuarios',       group: 'Usuarios' },
  'users.delete':      { label: 'Eliminar usuarios',     group: 'Usuarios' },
  'users.impersonate': { label: 'Impersonar usuarios',   group: 'Usuarios' },
  'roles.manage':      { label: 'Gestionar roles',       group: 'Roles' },
  'plugins.read':      { label: 'Ver módulos',           group: 'Módulos' },
  'plugins.manage':    { label: 'Gestionar módulos',     group: 'Módulos' },
  'office.view':       { label: 'Ver oficina virtual',        group: 'Oficina' },
  'office.checkin':    { label: 'Hacer check-in/check-out',  group: 'Oficina' },
  'office.manage':     { label: 'Administrar layouts',        group: 'Oficina' },
  'academy.read':      { label: 'Ver academia',          group: 'Academia' },
  'academy.manage':    { label: 'Gestionar academia',    group: 'Academia' },
  'reports.read':      { label: 'Ver reportes',          group: 'Reportes' },
  'system.admin':      { label: 'Administración total',  group: 'Sistema' },
};

/** A single permission entry — used both in the static map and in plugin-registered permissions */
export interface PermissionEntry {
  label: string;
  group: string;
  /** Set by plugins to indicate which plugin owns this permission */
  plugin?: string;
}

/** A preset role shipped by a plugin, shown as a "quick create" suggestion in the Roles UI */
export interface PresetRole {
  name: string;
  description?: string;
  permissions: string[];
  color?: string;
  /** Name of the plugin that registers this preset */
  plugin: string;
}

/** Default permissions for each built-in role */
export const BUILTIN_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: Object.values(PERMISSIONS) as Permission[],
  STAFF: [
    PERMISSIONS.OFFICE_VIEW,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.PLUGINS_READ,
    PERMISSIONS.ACADEMY_READ,
    PERMISSIONS.REPORTS_READ,
  ],
  PROFESSOR: [
    PERMISSIONS.OFFICE_VIEW,
    PERMISSIONS.ACADEMY_READ,
    PERMISSIONS.ACADEMY_MANAGE,
    PERMISSIONS.REPORTS_READ,
  ],
  STUDENT: [
    PERMISSIONS.OFFICE_VIEW,
    PERMISSIONS.ACADEMY_READ,
  ],
};
