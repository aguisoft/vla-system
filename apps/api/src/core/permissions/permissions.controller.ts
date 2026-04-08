import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@vla/shared';
import { PermissionsRegistryService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly registry: PermissionsRegistryService) {}

  @ApiOperation({ summary: 'Get all available permissions + plugin preset roles (Admin only)' })
  @Get()
  async getAll() {
    return this.registry.getRegistry();
  }
}
