import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type { PluginManifest, PluginDefinition } from '@vla/plugin-sdk';

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  definition: PluginDefinition;
  pluginDir: string;
}

/** Absolute path to the external plugins folder */
export const PLUGINS_DIR = path.resolve(process.cwd(), 'storage', 'plugins');

/** Minimum VLA core version — plugins whose vlaMinVersion is higher will be rejected */
export const VLA_CORE_VERSION = '1.0.0';

const logger = new Logger('PluginDiscovery');

/**
 * Scans PLUGINS_DIR at startup and returns every valid plugin found.
 * Called synchronously before the NestJS module graph is built so that
 * discovered modules can be included in AppModule.register().
 */
export function discoverPlugins(): DiscoveredPlugin[] {
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    return [];
  }

  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  const discovered: DiscoveredPlugin[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    const pluginDir = path.join(PLUGINS_DIR, entry.name);
    const manifestPath = path.join(pluginDir, 'plugin.json');
    const entryPoint = path.join(pluginDir, 'dist', 'index.js');

    if (!fs.existsSync(manifestPath)) {
      logger.warn(`Plugin folder "${entry.name}" is missing plugin.json — skipped`);
      continue;
    }
    if (!fs.existsSync(entryPoint)) {
      logger.warn(`Plugin "${entry.name}" is missing dist/index.js — skipped`);
      continue;
    }

    try {
      const manifest: PluginManifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf-8'),
      );

      if (!isCompatible(manifest.vlaMinVersion, VLA_CORE_VERSION)) {
        logger.warn(
          `Plugin "${manifest.name}" requires VLA >= ${manifest.vlaMinVersion} ` +
            `but core is ${VLA_CORE_VERSION} — skipped`,
        );
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(entryPoint) as { default?: unknown } & unknown;
      const definition = (mod as any).default ?? mod;

      if (typeof (definition as PluginDefinition)?.register !== 'function') {
        logger.warn(
          `Plugin "${entry.name}" dist/index.js does not export a PluginDefinition — skipped`,
        );
        continue;
      }

      discovered.push({ manifest, definition: definition as PluginDefinition, pluginDir });
      logger.log(`Discovered plugin: ${manifest.name} v${manifest.version}`);
    } catch (err) {
      logger.error(
        `Failed to load plugin "${entry.name}": ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  return discovered;
}

/**
 * Naive semver check: pluginRequires must be <= corVersion.
 * Supports "MAJOR.MINOR.PATCH" format only.
 */
function isCompatible(pluginRequires: string, coreVersion: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(pluginRequires);
  const [cMaj, cMin, cPat] = parse(coreVersion);

  if (rMaj !== cMaj) return cMaj > rMaj;
  if (rMin !== cMin) return cMin > rMin;
  return cPat >= rPat;
}
