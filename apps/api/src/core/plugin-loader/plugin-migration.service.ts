import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface MigrationStatus {
  pluginName: string;
  version: string;
  fileName: string;
  appliedAt: Date;
}

/**
 * Manages per-plugin SQL migrations.
 *
 * Convention:
 *   plugins/<name>/migrations/
 *     001_create_tables.up.sql
 *     001_create_tables.down.sql
 *     002_add_index.up.sql
 *     002_add_index.down.sql
 *
 * Each plugin gets an isolated PostgreSQL schema: plugin_<name>
 * Migrations run in a transaction with search_path set to the plugin schema.
 */
@Injectable()
export class PluginMigrationService {
  private readonly logger = new Logger(PluginMigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Schema name for a plugin (e.g., plugin_office → "plugin_office") */
  private schemaName(pluginName: string): string {
    return `plugin_${pluginName.replace(/-/g, '_')}`;
  }

  /**
   * Discover migration files in a plugin directory.
   * Returns sorted list of { version, fileName, upSql, downSql }.
   */
  private discoverMigrations(pluginDir: string): Array<{
    version: string;
    fileName: string;
    upSql: string;
    downSql: string | null;
  }> {
    const migrationsDir = path.join(pluginDir, 'migrations');
    if (!fs.existsSync(migrationsDir)) return [];

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.up.sql')).sort();
    return files.map(f => {
      const version = f.replace('.up.sql', '');
      const upSql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
      const downFile = path.join(migrationsDir, `${version}.down.sql`);
      const downSql = fs.existsSync(downFile) ? fs.readFileSync(downFile, 'utf-8') : null;
      return { version, fileName: f, upSql, downSql };
    });
  }

  private checksum(sql: string): string {
    return crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
  }

  /**
   * Run all pending migrations for a plugin.
   * Called by PluginLoaderService after register().
   */
  async runPending(pluginName: string, pluginDir: string): Promise<{ applied: number; skipped: number }> {
    const migrations = this.discoverMigrations(pluginDir);
    if (migrations.length === 0) return { applied: 0, skipped: 0 };

    const schema = this.schemaName(pluginName);

    // Ensure plugin schema exists
    await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // Get already applied migrations
    const applied = await this.prisma.pluginMigration.findMany({
      where: { pluginName },
      orderBy: { version: 'asc' },
    });
    const appliedVersions = new Set(applied.map(m => m.version));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const mig of migrations) {
      if (appliedVersions.has(mig.version)) {
        skippedCount++;
        continue;
      }

      try {
        // Run migration with plugin schema
        const sql = `SET search_path TO "${schema}", public;\n${mig.upSql}`;
        await this.prisma.$executeRawUnsafe(sql);

        // Record migration
        await this.prisma.pluginMigration.create({
          data: {
            pluginName,
            version: mig.version,
            fileName: mig.fileName,
            checksum: this.checksum(mig.upSql),
          },
        });

        this.logger.log(`Migration applied: ${pluginName}/${mig.version}`);
        appliedCount++;
      } catch (err) {
        this.logger.error(
          `Migration FAILED: ${pluginName}/${mig.version}: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err; // Stop on first failure
      }
    }

    // Reset search path
    await this.prisma.$executeRawUnsafe('SET search_path TO public');

    if (appliedCount > 0) {
      this.logger.log(`Plugin "${pluginName}": ${appliedCount} migrations applied, ${skippedCount} skipped`);
    }

    return { applied: appliedCount, skipped: skippedCount };
  }

  /**
   * Rollback all migrations for a plugin (in reverse order).
   * Called on plugin uninstall.
   */
  async rollbackAll(pluginName: string, pluginDir: string): Promise<number> {
    const migrations = this.discoverMigrations(pluginDir).reverse();
    const schema = this.schemaName(pluginName);
    let rolledBack = 0;

    for (const mig of migrations) {
      const record = await this.prisma.pluginMigration.findUnique({
        where: { pluginName_version: { pluginName, version: mig.version } },
      });
      if (!record) continue;

      if (mig.downSql) {
        try {
          const sql = `SET search_path TO "${schema}", public;\n${mig.downSql}`;
          await this.prisma.$executeRawUnsafe(sql);
          this.logger.log(`Migration rolled back: ${pluginName}/${mig.version}`);
        } catch (err) {
          this.logger.error(`Rollback FAILED: ${pluginName}/${mig.version}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await this.prisma.pluginMigration.delete({
        where: { pluginName_version: { pluginName, version: mig.version } },
      });
      rolledBack++;
    }

    // Drop plugin schema if empty
    try {
      await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      this.logger.log(`Schema "${schema}" dropped`);
    } catch { /* ignore */ }

    await this.prisma.$executeRawUnsafe('SET search_path TO public');
    return rolledBack;
  }

  /** Get migration status for a plugin */
  async getStatus(pluginName: string): Promise<MigrationStatus[]> {
    const records = await this.prisma.pluginMigration.findMany({
      where: { pluginName },
      orderBy: { version: 'asc' },
    });
    return records.map(r => ({
      pluginName: r.pluginName,
      version: r.version,
      fileName: r.fileName,
      appliedAt: r.appliedAt,
    }));
  }

  /** Get migration status for all plugins */
  async getAllStatus(): Promise<Record<string, MigrationStatus[]>> {
    const records = await this.prisma.pluginMigration.findMany({ orderBy: { appliedAt: 'asc' } });
    const map: Record<string, MigrationStatus[]> = {};
    for (const r of records) {
      if (!map[r.pluginName]) map[r.pluginName] = [];
      map[r.pluginName].push({ pluginName: r.pluginName, version: r.version, fileName: r.fileName, appliedAt: r.appliedAt });
    }
    return map;
  }
}
