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

  @ApiOperation({ summary: 'Get registered hook names (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('hooks')
  getHooks() {
    return this.hooks.getRegisteredHooks();
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
    try {
      return await this.registry.deactivate(name);
    } catch {
      throw new NotFoundException(`Plugin "${name}" not found`);
    }
  }

  @ApiOperation({ summary: 'Update plugin configuration (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':name/config')
  async updateConfig(@Param('name') name: string, @Body() dto: UpdateConfigDto) {
    try {
      return await this.registry.updateConfig(name, dto.config);
    } catch {
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
    return this.uploadService.install(file.buffer);
  }
}
