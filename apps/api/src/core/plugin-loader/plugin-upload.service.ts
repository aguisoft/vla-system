import * as fs from 'fs';
import * as path from 'path';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import type { PluginManifest } from '@vla/plugin-sdk';
import { PLUGINS_DIR, VLA_CORE_VERSION } from './plugin-discovery';
import { PluginVersionService } from './plugin-version.service';

export interface UploadResult {
  name: string;
  version: string;
  previousVersion?: string;
  message: string;
  restarting: boolean;
}

@Injectable()
export class PluginUploadService {
  private readonly logger = new Logger(PluginUploadService.name);

  constructor(private readonly versionService: PluginVersionService) {}

  /**
   * Receives the raw .vla.zip buffer, validates its contents, backs up the
   * current version, and installs the plugin to storage/plugins/{name}/.
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

    // ── 3. Backup current version before overwriting ────────────────────────
    const pluginDir = path.join(PLUGINS_DIR, manifest.name);
    let previousVersion: string | undefined;

    if (fs.existsSync(pluginDir)) {
      try {
        const oldManifest = JSON.parse(
          fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8'),
        );
        previousVersion = oldManifest.version;
        await this.versionService.backupCurrent(manifest.name, previousVersion!, pluginDir);
        // Keep only last 3 backups
        await this.versionService.cleanup(manifest.name, 3);
      } catch (err) {
        this.logger.warn(`Could not backup ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
      fs.rmSync(pluginDir, { recursive: true, force: true });
    }

    // ── 4. Extract to storage/plugins/{name}/ ───────────────────────────────
    fs.mkdirSync(pluginDir, { recursive: true });
    zip.extractAllTo(pluginDir, true);
    this.logger.log(`Plugin extracted to ${pluginDir}${previousVersion ? ` (updated from v${previousVersion})` : ' (new install)'}`);

    // ── 5. Schedule graceful restart ─────────────────────────────────────────
    setImmediate(() => {
      this.logger.log(`Restarting server to load plugin "${manifest.name}"…`);
      process.exit(0);
    });

    return {
      name: manifest.name,
      version: manifest.version,
      previousVersion,
      message: previousVersion
        ? `Plugin "${manifest.name}" updated from v${previousVersion} to v${manifest.version}. Server is restarting.`
        : `Plugin "${manifest.name}" v${manifest.version} installed. Server is restarting.`,
      restarting: true,
    };
  }

  /**
   * Install a plugin from a remote URL.
   */
  async installFromUrl(url: string): Promise<UploadResult> {
    this.logger.log(`Downloading plugin from ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException(`Download failed: HTTP ${res.status}`);

    const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
    if (contentLength > 20 * 1024 * 1024) {
      throw new BadRequestException('Plugin too large (max 20MB)');
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return this.install(buffer);
  }

  /** Removes a plugin from disk */
  uninstall(pluginName: string): void {
    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
      this.logger.log(`Plugin files removed: ${pluginDir}`);
    }
  }

  /** Rollback to previous version */
  async rollback(pluginName: string): Promise<{ ok: boolean; restoredVersion?: string; error?: string; restarting?: boolean }> {
    const pluginDir = path.join(PLUGINS_DIR, pluginName);
    const result = await this.versionService.rollback(pluginName, pluginDir);

    if (result.ok) {
      setImmediate(() => {
        this.logger.log(`Restarting server after rollback of "${pluginName}" to v${result.restoredVersion}`);
        process.exit(0);
      });
      return { ...result, restarting: true };
    }

    return result;
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
