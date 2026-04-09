import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const PLUGINS_DIR = path.resolve(process.cwd(), 'storage/plugins');

export interface DependencyWarning {
  plugin: string;
  dependents: string[];
  message: string;
}

/**
 * Tracks plugin dependencies by reading all manifests.
 * Used to warn before deactivating a plugin that others depend on.
 */
@Injectable()
export class PluginDependencyService {
  private readonly logger = new Logger(PluginDependencyService.name);

  /** Map of pluginName → plugins that depend on it */
  private reverseDeps = new Map<string, string[]>();

  /** Rebuild the dependency graph by scanning all plugin manifests */
  rebuild(): void {
    this.reverseDeps.clear();

    if (!fs.existsSync(PLUGINS_DIR)) return;

    const dirs = fs.readdirSync(PLUGINS_DIR).filter(d =>
      fs.statSync(path.join(PLUGINS_DIR, d)).isDirectory(),
    );

    for (const dir of dirs) {
      try {
        const manifestPath = path.join(PLUGINS_DIR, dir, 'plugin.json');
        if (!fs.existsSync(manifestPath)) continue;
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const deps: string[] = manifest.dependencies ?? [];
        for (const dep of deps) {
          if (!this.reverseDeps.has(dep)) this.reverseDeps.set(dep, []);
          this.reverseDeps.get(dep)!.push(manifest.name);
        }
      } catch { /* skip malformed */ }
    }
  }

  /**
   * Check if deactivating a plugin would break others.
   * Returns warnings for each dependent plugin.
   */
  checkDeactivation(pluginName: string): DependencyWarning[] {
    this.rebuild(); // Always fresh
    const dependents = this.reverseDeps.get(pluginName) ?? [];
    if (dependents.length === 0) return [];

    return [{
      plugin: pluginName,
      dependents,
      message: `Los plugins ${dependents.join(', ')} dependen de "${pluginName}". Desactivarlo puede causar errores.`,
    }];
  }

  /** Get the full dependency graph */
  getGraph(): Record<string, string[]> {
    this.rebuild();
    const graph: Record<string, string[]> = {};
    for (const [dep, dependents] of this.reverseDeps) {
      graph[dep] = dependents;
    }
    return graph;
  }
}
