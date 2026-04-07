import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import type { PluginManifest } from '@vla/plugin-sdk';
import { PLUGINS_DIR, VLA_CORE_VERSION } from './plugin-discovery';

export interface UploadResult {
  name: string;
  version: string;
  message: string;
  restarting: boolean;
}

@Injectable()
export class PluginUploadService {
  private readonly logger = new Logger(PluginUploadService.name);

  /**
   * Receives the raw .vla.zip buffer, validates its contents, and installs
   * the plugin to storage/plugins/{name}/.
   *
   * After a successful install the server schedules a graceful restart so the
   * new plugin module is picked up on the next boot.
   */
  async install(fileBuffer: Buffer): Promise<UploadResult> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(fileBuffer);
    } catch {
      throw new BadRequestException('Invalid zip file');
    }

    // ── 1. Read and validate plugin.json ────────────────────────────────────
    const manifestEntry = zip.getEntry('plugin.json');
    if (!manifestEntry) {
      throw new BadRequestException('plugin.json not found in archive');
    }

    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as PluginManifest;
    } catch {
      throw new BadRequestException('plugin.json is not valid JSON');
    }

    this.validateManifest(manifest);

    // ── 2. Check that dist/index.js is present in the zip ───────────────────
    const entryPoint = zip.getEntry('dist/index.js');
    if (!entryPoint) {
      throw new BadRequestException('dist/index.js not found in archive');
    }

    // ── 3. Extract to storage/plugins/{name}/ ───────────────────────────────
    const pluginDir = path.join(PLUGINS_DIR, manifest.name);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }
    fs.mkdirSync(pluginDir, { recursive: true });

    zip.extractAllTo(pluginDir, true);
    this.logger.log(`Plugin extracted to ${pluginDir}`);

    // ── 4. Schedule graceful restart ─────────────────────────────────────────
    // Give the HTTP response time to reach the client before exiting.
    setImmediate(() => {
      this.logger.log(`Restarting server to load plugin "${manifest.name}"…`);
      process.exit(0);
    });

    return {
      name: manifest.name,
      version: manifest.version,
      message: `Plugin "${manifest.name}" installed. Server is restarting to load it.`,
      restarting: true,
    };
  }

  /** Removes a plugin from disk (does not affect DB — the registry handles that) */
  uninstall(pluginName: string): void {
    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
      this.logger.log(`Plugin files removed: ${pluginDir}`);
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private validateManifest(m: Partial<PluginManifest>): asserts m is PluginManifest {
    const required: (keyof PluginManifest)[] = [
      'name', 'version', 'description', 'author', 'vlaMinVersion', 'permissions',
    ];
    for (const field of required) {
      if (!m[field]) {
        throw new BadRequestException(`plugin.json missing required field: "${String(field)}"`);
      }
    }

    if (!/^[a-z0-9-]+$/.test(m.name!)) {
      throw new BadRequestException(
        'plugin.json "name" must be kebab-case (lowercase letters, numbers, hyphens)',
      );
    }

    if (!this.semverCompatible(m.vlaMinVersion!, VLA_CORE_VERSION)) {
      throw new BadRequestException(
        `Plugin requires VLA >= ${m.vlaMinVersion} but core is ${VLA_CORE_VERSION}`,
      );
    }
  }

  private semverCompatible(requires: string, core: string): boolean {
    const parse = (v: string) => v.split('.').map(Number);
    const [rMaj, rMin, rPat] = parse(requires);
    const [cMaj, cMin, cPat] = parse(core);
    if (rMaj !== cMaj) return cMaj > rMaj;
    if (rMin !== cMin) return cMin > rMin;
    return cPat >= rPat;
  }
}
