import { Injectable, Logger } from '@nestjs/common';

interface ActionHandler<T = any> {
  handler: (payload: T) => void | Promise<void>;
  priority: number;
  pluginName: string;
}

interface FilterHandler<T = any> {
  handler: (payload: T) => T | Promise<T>;
  priority: number;
  pluginName: string;
}

export interface HookRegistrationOptions {
  /** Lower numbers run first. Default: 10 */
  priority?: number;
  /** Name of the plugin registering this hook (for debugging). Default: 'core' */
  pluginName?: string;
}

/** Metadata for a declared hook (used for documentation / admin UI) */
export interface HookMetadata {
  description?: string;
  payload?: Record<string, string>;
}

/** Full hook info returned by the discovery endpoint */
export interface DeclaredHookInfo {
  hookName: string;
  pluginName: string;
  type: 'action' | 'filter';
  description?: string;
  payload?: Record<string, string>;
  listeners: { pluginName: string; priority: number }[];
}

@Injectable()
export class HookService {
  private readonly logger = new Logger(HookService.name);
  private readonly actions = new Map<string, ActionHandler[]>();
  private readonly filters = new Map<string, FilterHandler[]>();
  /** Metadata registry for declared hooks */
  private readonly metadata = new Map<string, { pluginName: string; type: 'action' | 'filter'; meta: HookMetadata }>();

  // ─── Actions ─────────────────────────────────────────────────────────────

  registerAction<T = any>(
    hookName: string,
    handler: (payload: T) => void | Promise<void>,
    options: HookRegistrationOptions = {},
  ): void {
    const { priority = 10, pluginName = 'core' } = options;
    const list = this.actions.get(hookName) ?? [];
    list.push({ handler, priority, pluginName });
    list.sort((a, b) => a.priority - b.priority);
    this.actions.set(hookName, list);
  }

  async doAction<T = any>(hookName: string, payload: T): Promise<void> {
    const handlers = this.actions.get(hookName) ?? [];
    for (const { handler, pluginName } of handlers) {
      if (pluginName.endsWith(':declared')) continue; // skip declaration markers
      try {
        await handler(payload);
      } catch (err) {
        this.logger.error(
          `Action hook "${hookName}" failed in plugin "${pluginName}"`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // ─── Filters ─────────────────────────────────────────────────────────────

  registerFilter<T = any>(
    hookName: string,
    handler: (payload: T) => T | Promise<T>,
    options: HookRegistrationOptions = {},
  ): void {
    const { priority = 10, pluginName = 'core' } = options;
    const list = this.filters.get(hookName) ?? [];
    list.push({ handler, priority, pluginName });
    list.sort((a, b) => a.priority - b.priority);
    this.filters.set(hookName, list);
  }

  async applyFilter<T = any>(hookName: string, payload: T): Promise<T> {
    const handlers = this.filters.get(hookName) ?? [];
    let value = payload;
    for (const { handler, pluginName } of handlers) {
      try {
        value = await handler(value);
      } catch (err) {
        this.logger.error(
          `Filter hook "${hookName}" failed in plugin "${pluginName}"`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    return value;
  }

  // ─── Declaration & Introspection ────────────────────────────────────────

  /**
   * Declare that a hook exists with optional metadata.
   * Declared hooks appear in the admin Hooks tab for documentation.
   */
  declareHook(
    hookName: string,
    pluginName = 'core',
    meta?: HookMetadata,
  ): void {
    // Ensure it appears in the actions map for getRegisteredHooks()
    if (!this.actions.has(hookName)) {
      this.actions.set(hookName, []);
    }
    // Determine type: if it's in filters map, it's a filter; else action
    const type = this.filters.has(hookName) ? 'filter' : 'action';
    this.metadata.set(hookName, { pluginName, type, meta: meta ?? {} });
  }

  /** Basic hook list (backward compatible) */
  getRegisteredHooks(): { actions: string[]; filters: string[] } {
    return {
      actions: Array.from(this.actions.keys()),
      filters: Array.from(this.filters.keys()),
    };
  }

  /** Detailed hook catalog for the admin UI */
  getHooksCatalog(): DeclaredHookInfo[] {
    const catalog: DeclaredHookInfo[] = [];
    const seen = new Set<string>();

    // Actions
    for (const [hookName, handlers] of this.actions) {
      seen.add(hookName);
      const meta = this.metadata.get(hookName);
      catalog.push({
        hookName,
        pluginName: meta?.pluginName ?? 'core',
        type: meta?.type ?? 'action',
        description: meta?.meta.description,
        payload: meta?.meta.payload,
        listeners: handlers
          .filter(h => !h.pluginName.endsWith(':declared'))
          .map(h => ({ pluginName: h.pluginName, priority: h.priority })),
      });
    }

    // Filters not already in actions
    for (const [hookName, handlers] of this.filters) {
      if (seen.has(hookName)) {
        // Merge listeners into existing entry
        const existing = catalog.find(c => c.hookName === hookName);
        if (existing) {
          existing.type = 'filter';
          existing.listeners.push(...handlers.map(h => ({ pluginName: h.pluginName, priority: h.priority })));
        }
        continue;
      }
      const meta = this.metadata.get(hookName);
      catalog.push({
        hookName,
        pluginName: meta?.pluginName ?? 'core',
        type: 'filter',
        description: meta?.meta.description,
        payload: meta?.meta.payload,
        listeners: handlers.map(h => ({ pluginName: h.pluginName, priority: h.priority })),
      });
    }

    return catalog.sort((a, b) => a.hookName.localeCompare(b.hookName));
  }

  getActionHandlers(hookName: string): { pluginName: string; priority: number }[] {
    return (this.actions.get(hookName) ?? []).map(({ pluginName, priority }) => ({ pluginName, priority }));
  }

  getFilterHandlers(hookName: string): { pluginName: string; priority: number }[] {
    return (this.filters.get(hookName) ?? []).map(({ pluginName, priority }) => ({ pluginName, priority }));
  }
}
