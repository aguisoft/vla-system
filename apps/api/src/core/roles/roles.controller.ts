import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService, CreateRoleDto, UpdateRoleDto } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@vla/shared';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'List all custom roles' })
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @ApiOperation({ summary: 'Get a custom role by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a custom role' })
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a custom role' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a custom role' })
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.rolesService.delete(id);
  }

  @ApiOperation({ summary: 'Assign custom role to user (null to remove)' })
  @Patch(':id/assign/:userId')
  assignToUser(@Param('id') roleId: string, @Param('userId') userId: string) {
    return this.rolesService.assignToUser(userId, roleId);
  }

  @ApiOperation({ summary: 'Remove custom role from user' })
  @Delete(':id/assign/:userId')
  removeFromUser(@Param('userId') userId: string) {
    return this.rolesService.assignToUser(userId, null);
  }
}
