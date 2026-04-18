import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { UserRole } from '@vla/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HookService } from '../hooks/hook.service';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginUploadService } from '../plugin-loader/plugin-upload.service';
import { PluginMigrationService } from '../plugin-loader/plugin-migration.service';
import { PluginVersionService } from '../plugin-loader/plugin-version.service';
import { PluginDependencyService } from '../plugin-loader/plugin-dependency.service';
import { PushService } from '../push/push.service';

class UpdateConfigDto {
  @ApiProperty({ description: 'Arbitrary plugin configuration object' })
  @IsObject()
  config: Record<string, unknown>;
}

class TogglePluginDto {
  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('Plugins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('plugins')
export class PluginRegistryController {
  constructor(
    private readonly registry: PluginRegistryService,
    private readonly hooks: HookService,
    private readonly uploadService: PluginUploadService,
    private readonly migrations: PluginMigrationService,
    private readonly versions: PluginVersionService,
    private readonly dependencies: PluginDependencyService,
    private readonly push: PushService,
  ) {}

  @ApiOperation({ summary: 'List all plugins (admin sees all, users see active only)' })
  @Get()
  getPlugins() {
    return this.registry.getActive();
  }

  @ApiOperation({ summary: 'List ALL plugins including inactive (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('all')
  getAllPlugins() {
    return this.registry.getAll();
  }

  @ApiOperation({ summary: 'Get hook catalog with metadata (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('hooks')
  getHooks() {
    return this.hooks.getHooksCatalog();
  }

  @ApiOperation({ summary: 'Get database migrations status for all plugins (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('migrations')
  getMigrations() {
    return this.migrations.getAllStatus();
  }

  @ApiOperation({ summary: 'Activate a plugin (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':name/activate')
  async activate(@Param('name') name: string) {
    try {
      return await this.registry.activate(name);
    } catch {
      throw new NotFoundException(`Plugin "${name}" not found`);
    }
  }

  @ApiOperation({ summary: 'Deactivate a plugin (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':name/deactivate')
  async deactivate(@Param('name') name: string) {
    const warnings = this.dependencies.checkDeactivation(name);
    try {
      const result = await this.registry.deactivate(name);
      return { ...result, warnings };
    } catch {
      throw new NotFoundException(`Plugin "${name}" not found`);
    }
  }

  @ApiOperation({ summary: 'Get plugin settings schema (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':name/settings-schema')
  getSettingsSchema(@Param('name') name: string) {
    return this.registry.getSettingsSchema(name) ?? { fields: [] };
  }

  @ApiOperation({ summary: 'Update plugin configuration (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':name/config')
  async updateConfig(@Param('name') name: string, @Body() dto: UpdateConfigDto) {
    try {
      return await this.registry.updateConfig(name, dto.config);
    } catch (e: any) {
      if (e.message?.startsWith('Config validation')) {
        throw new NotFoundException(e.message);
      }
      throw new NotFoundException(`Plugin "${name}" not found`);
    }
  }

  @ApiOperation({ summary: 'Upload and install a .vla.zip plugin package (admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadPlugin(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new NotFoundException('No file provided');
    }
    const result = await this.uploadService.install(file.buffer);

    this.push.sendToAdmins({
      title: `Plugin instalado: ${result.name}`,
      body:  `v${result.version} instalado correctamente`,
      url:   '/dashboard/admin',
    }).catch(() => {});

    return result;
  }

  @ApiOperation({ summary: 'Install plugin from URL (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('install-url')
  async installFromUrl(@Body() body: { url: string }) {
    if (!body.url) throw new NotFoundException('url is required');
    return this.uploadService.installFromUrl(body.url);
  }

  @ApiOperation({ summary: 'Get version history for a plugin (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':name/versions')
  getVersions(@Param('name') name: string) {
    return this.versions.getHistory(name);
  }

  @ApiOperation({ summary: 'Rollback plugin to previous version (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':name/rollback')
  async rollbackPlugin(@Param('name') name: string) {
    return this.uploadService.rollback(name);
  }

  @ApiOperation({ summary: 'Check dependencies before deactivation (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':name/dependents')
  getDependents(@Param('name') name: string) {
    return this.dependencies.checkDeactivation(name);
  }
}
