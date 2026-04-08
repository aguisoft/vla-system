import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { HookService } from '../hooks/hook.service';
import { CORE_HOOKS } from '../hooks/hook.constants';
import { CreateUserDto } from './dto/create-user.dto';

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hooks: HookService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) return null;
    return this.hooks.applyFilter(CORE_HOOKS.USER_SERIALIZE, user);
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const { password: _, ...data } = dto;

    const user = await this.prisma.user.create({
      data: { ...data, passwordHash },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.hooks.doAction(CORE_HOOKS.USER_CREATED, { user });

    return user;
  }

  async findOrFail(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOrFail(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...dto, role: dto.role as any },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.hooks.doAction(CORE_HOOKS.USER_UPDATED, { userId: id, changes: dto });

    return user;
  }

  async delete(id: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('No puedes eliminar tu propia cuenta');
    const user = await this.findOrFail(id);

    // Prevent deleting last admin
    if ((user as any).role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) throw new ForbiddenException('No puedes eliminar al único administrador activo');
    }

    await this.prisma.user.delete({ where: { id } });
    await this.hooks.doAction(CORE_HOOKS.USER_UPDATED, { userId: id, changes: { deleted: true } });
    return { ok: true };
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOrFail(id);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  async findAllWithBitrix() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true, color: true, permissions: true } },
        bitrixMapping: { select: { bitrixUserId: true } },
      },
      orderBy: { firstName: 'asc' },
    });
  }
}
