import { Injectable, NotFoundException, ForbiddenException, ConflictException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BUILTIN_ROLE_PERMISSIONS } from '@vla/shared';

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

const SYSTEM_ROLE_COLORS: Record<string, string> = {
  ADMIN:     '#ef4444',
  STAFF:     '#3b82f6',
  PROFESSOR: '#8b5cf6',
  STUDENT:   '#10b981',
};

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed built-in system roles into DB so their permissions can be edited at runtime.
    // Uses upsert so it never overwrites existing edits.
    for (const [roleName, perms] of Object.entries(BUILTIN_ROLE_PERMISSIONS)) {
      await this.prisma.customRole.upsert({
        where: { name: roleName },
        create: {
          name: roleName,
          description: `Rol del sistema: ${roleName}`,
          permissions: perms as string[],
          color: SYSTEM_ROLE_COLORS[roleName] ?? '#6B7280',
          isSystem: true,
        },
        update: {}, // never overwrite — admin edits are preserved
      });
    }
  }

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

    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new ForbiddenException('Cannot rename a system role');
    }

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
