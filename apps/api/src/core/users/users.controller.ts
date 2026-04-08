import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';

class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
import { UsersService, UpdateUserDto } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@vla/shared';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'List all users with Bitrix mapping (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAllWithBitrix();
  }

  @ApiOperation({ summary: 'Create user (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiOperation({ summary: 'Get user by id' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOrFail(id);
  }

  @ApiOperation({ summary: 'Update user (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Reset user password (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Patch(':id/password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.password);
  }

  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.usersService.delete(id, req.user.id);
  }
}
