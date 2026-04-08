import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
  color?: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
  color?: string;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.customRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.customRole.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);

    return this.prisma.customRole.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
        permissions: dto.permissions,
        color: dto.color ?? '#6B7280',
      },
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findOne(id);

    if (dto.name && dto.name !== role.name) {
      const conflict = await this.prisma.customRole.findUnique({ where: { name: dto.name } });
      if (conflict) throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    return this.prisma.customRole.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async delete(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new ForbiddenException('Cannot delete a system role');

    // Unassign users before deletion (cascade SetNull handles it via FK, but let's be explicit)
    await this.prisma.customRole.delete({ where: { id } });
    return { ok: true };
  }

  async assignToUser(userId: string, roleId: string | null) {
    if (roleId) await this.findOne(roleId); // validate role exists
    await this.prisma.user.update({
      where: { id: userId },
      data: { customRoleId: roleId },
    });
    return { ok: true };
  }
}
