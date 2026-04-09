import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs-extra';
import * as path from 'path';

const BACKUPS_DIR = path.resolve(process.cwd(), 'storage/plugins-backups');

export interface VersionInfo {
  version: string;
  backupPath: string;
  installedAt: Date;
}

/**
 * Manages plugin version backups for rollback support.
 * Before each install/update, the current plugin directory is backed up.
 * On rollback, the backup is restored.
 */
@Injectable()
export class PluginVersionService {
  private readonly logger = new Logger(PluginVersionService.name);

  constructor(private readonly prisma: PrismaService) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  /**
   * Backup the current plugin directory before an update.
   * Returns the backup path, or null if the plugin doesn't exist yet.
   */
  async backupCurrent(pluginName: string, currentVersion: string, pluginDir: string): Promise<string | null> {
    if (!fs.existsSync(pluginDir)) return null;

    const backupName = `${pluginName}-${currentVersion}-${Date.now()}`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    try {
      fs.copySync(pluginDir, backupPath);

      await this.prisma.pluginVersion.create({
        data: {
          pluginName,
          version: currentVersion,
          backupPath,
        },
      });

      this.logger.log(`Backup created: ${pluginName} v${currentVersion} → ${backupName}`);
      return backupPath;
    } catch (err) {
      this.logger.error(`Backup failed for ${pluginName}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Rollback to the most recent backup.
   * Copies the backup over the current plugin directory.
   */
  async rollback(pluginName: string, pluginDir: string): Promise<{ ok: boolean; restoredVersion?: string; error?: string }> {
    const latest = await this.prisma.pluginVersion.findFirst({
      where: { pluginName },
      orderBy: { installedAt: 'desc' },
    });

    if (!latest) {
      return { ok: false, error: 'No hay versiones anteriores para restaurar' };
    }

    if (!fs.existsSync(latest.backupPath)) {
      return { ok: false, error: `Backup no encontrado: ${latest.backupPath}` };
    }

    try {
      // Replace current with backup
      fs.removeSync(pluginDir);
      fs.copySync(latest.backupPath, pluginDir);

      // Remove the used backup record (it's now the active version)
      await this.prisma.pluginVersion.delete({ where: { id: latest.id } });

      this.logger.log(`Rollback: ${pluginName} restored to v${latest.version}`);
      return { ok: true, restoredVersion: latest.version };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Get version history for a plugin */
  async getHistory(pluginName: string): Promise<VersionInfo[]> {
    const records = await this.prisma.pluginVersion.findMany({
      where: { pluginName },
      orderBy: { installedAt: 'desc' },
    });
    return records.map(r => ({
      version: r.version,
      backupPath: r.backupPath,
      installedAt: r.installedAt,
    }));
  }

  /** Cleanup old backups — keep only the last N per plugin */
  async cleanup(pluginName: string, keepLast = 3): Promise<number> {
    const all = await this.prisma.pluginVersion.findMany({
      where: { pluginName },
      orderBy: { installedAt: 'desc' },
    });

    let removed = 0;
    for (const record of all.slice(keepLast)) {
      try { fs.removeSync(record.backupPath); } catch { /* ignore */ }
      await this.prisma.pluginVersion.delete({ where: { id: record.id } });
      removed++;
    }

    if (removed > 0) this.logger.log(`Cleaned up ${removed} old backups for ${pluginName}`);
    return removed;
  }
}
