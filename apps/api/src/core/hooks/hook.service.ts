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

/**
 * VLA Hook System
 *
 * Two hook types:
 *  - Actions: one-way notifications. Plugins react to events but cannot alter
 *             the original data. Use `registerAction` / `doAction`.
 *  - Filters: data-transformation chains. Each handler receives the current
 *             value and must return the (possibly modified) value.
 *             Use `registerFilter` / `applyFilter`.
 *
 * Priority: handlers are executed in ascending order (1 before 10 before 100).
 */
@Injectable()
export class HookService {
  private readonly logger = new Logger(HookService.name);
  private readonly actions = new Map<string, ActionHandler[]>();
  private readonly filters = new Map<string, FilterHandler[]>();

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Register a listener for an action hook.
   *
   * @example
   * hookService.registerAction(CORE_HOOKS.USER_CREATED, async ({ user }) => {
   *   await sendWelcomeEmail(user);
   * }, { pluginName: 'mailer' });
   */
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

  /**
   * Fire an action hook. All registered listeners run in priority order.
   * Errors in individual listeners are caught and logged so they don't block
   * the rest of the chain.
   */
  async doAction<T = any>(hookName: string, payload: T): Promise<void> {
    const handlers = this.actions.get(hookName) ?? [];
    for (const { handler, pluginName } of handlers) {
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

  /**
   * Register a filter hook. The handler receives the current value and must
   * return the (possibly modified) value.
   *
   * @example
   * hookService.registerFilter(CORE_HOOKS.USER_SERIALIZE, (user) => ({
   *   ...user,
   *   displayName: `${user.firstName} ${user.lastName}`,
   * }), { pluginName: 'profile' });
   */
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

  /**
   * Run a filter chain, returning the final transformed value.
   * Errors in individual handlers are caught; the last good value is passed on.
   */
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

  // ─── Introspection ───────────────────────────────────────────────────────

  /** Returns the names of all registered action and filter hooks. */
  getRegisteredHooks(): { actions: string[]; filters: string[] } {
    return {
      actions: Array.from(this.actions.keys()),
      filters: Array.from(this.filters.keys()),
    };
  }

  /** Returns all handlers registered for a specific action hook. */
  getActionHandlers(hookName: string): { pluginName: string; priority: number }[] {
    return (this.actions.get(hookName) ?? []).map(({ pluginName, priority }) => ({
      pluginName,
      priority,
    }));
  }

  /** Returns all handlers registered for a specific filter hook. */
  getFilterHandlers(hookName: string): { pluginName: string; priority: number }[] {
    return (this.filters.get(hookName) ?? []).map(({ pluginName, priority }) => ({
      pluginName,
      priority,
    }));
  }

  /**
   * Declare that a hook name exists without attaching logic.
   * Use this instead of registering a no-op handler.
   * Declared hooks appear in GET /plugins/hooks for documentation purposes.
   */
  declareHook(hookName: string, pluginName = 'core'): void {
    if (!this.actions.has(hookName)) {
      this.actions.set(hookName, []);
    }
    // Store as metadata only — no handler fn, skipped during doAction
    const list = this.actions.get(hookName)!;
    const alreadyDeclared = list.some((h) => h.pluginName === pluginName && !h.handler.name);
    if (!alreadyDeclared) {
      list.push({
        handler: async () => { /* declaration marker — never executed */ },
        priority: 999,
        pluginName: `${pluginName}:declared`,
      });
    }
  }
}
