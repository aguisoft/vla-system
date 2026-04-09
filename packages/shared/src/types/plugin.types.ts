// ─── Plugin definition ────────────────────────────────────────────────────────

/**
 * Contract that every VLA plugin must satisfy.
 *
 * Plugins declare themselves by calling PluginRegistryService.register(plugin)
 * inside their NestJS module's `onModuleInit()` hook.
 */
export interface VLAPlugin {
  /** Unique machine-readable identifier. Use kebab-case, e.g. "virtual-office" */
  name: string;
  /** Semantic version, e.g. "1.0.0" */
  version: string;
  /** Human-readable description shown in the admin panel */
  description: string;
  /** Frontend route, e.g. "/dashboard/office". Omit for backend-only plugins. */
  route?: string;
  /** Icon identifier used by the frontend nav sidebar */
  icon?: string;
  /** When true, only users with the ADMIN role can access this plugin's UI */
  adminOnly?: boolean;
  /**
   * Other plugin names this plugin depends on.
   * The registry will warn if a dependency is missing or inactive.
   */
  dependencies?: string[];

  // ── Lifecycle callbacks (all optional) ────────────────────────────────
  /** Called by the registry the first time the plugin is installed */
  onInstall?: () => Promise<void>;
  /** Called by the registry each time the plugin is activated */
  onActivate?: () => Promise<void>;
  /** Called by the registry each time the plugin is deactivated */
  onDeactivate?: () => Promise<void>;
  /** Called by the registry before the plugin is uninstalled */
  onUninstall?: () => Promise<void>;
}

// ─── Runtime state ───────────────────────────────────────────────────────────

/**
 * Plugin metadata as stored in the DB and returned by the REST API.
 */
export interface PluginRegistration {
  name: string;
  version: string;
  description: string;
  route?: string;
  icon?: string;
  adminOnly: boolean;
  isActive: boolean;
  hasFrontend?: boolean;
  /** Permissions a user needs at least one of to see/access this plugin. Empty = visible to all. */
  accessPermissions: string[];
  /** Core integrations that are not configured — plugin is in degraded mode if non-empty */
  unmetRequirements?: string[];
  /** Whether this plugin has a declarative settings schema */
  hasSettings?: boolean;
  config?: Record<string, unknown> | null;
  installedAt: Date;
  updatedAt: Date;
}

/**
 * Payload returned by GET /plugins (public, authenticated users).
 * Strips sensitive config values.
 */
export interface PluginSummary {
  name: string;
  version: string;
  description: string;
  route?: string;
  icon?: string;
  adminOnly: boolean;
  isActive: boolean;
  hasFrontend?: boolean;
}
