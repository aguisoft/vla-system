import { Injectable } from '@nestjs/common';
import { HookService } from '../hooks/hook.service';
import { CORE_HOOKS } from '../hooks/hook.constants';
import { PERMISSION_META, PermissionEntry, PresetRole } from '@vla/shared';

export type PermissionsMap = Record<string, PermissionEntry>;

@Injectable()
export class PermissionsRegistryService {
  /** Cached result — invalidated whenever a plugin is activated or deactivated */
  private _cache: { permissions: PermissionsMap; presetRoles: PresetRole[] } | null = null;

  constructor(private readonly hooks: HookService) {
    // Invalidate cache on plugin lifecycle events so the next request re-computes
    hooks.registerAction(CORE_HOOKS.PLUGIN_ACTIVATED, async () => { this._cache = null; });
    hooks.registerAction(CORE_HOOKS.PLUGIN_DEACTIVATED, async () => { this._cache = null; });
  }

  /**
   * Returns the full permissions map (core + all plugin-registered permissions)
   * and the list of preset roles contributed by plugins.
   * Result is cached until a plugin is activated / deactivated.
   */
  async getRegistry(): Promise<{ permissions: PermissionsMap; presetRoles: PresetRole[] }> {
    if (this._cache) return this._cache;

    // Start from core permissions defined in @vla/shared
    const base: PermissionsMap = { ...(PERMISSION_META as unknown as PermissionsMap) };

    const permissions: PermissionsMap = await this.hooks.applyFilter(
      CORE_HOOKS.PERMISSIONS_REGISTER,
      base,
    );

    const presetRoles: PresetRole[] = await this.hooks.applyFilter(
      CORE_HOOKS.ROLES_PRESET,
      [],
    );

    this._cache = { permissions, presetRoles };
    return this._cache;
  }
}
