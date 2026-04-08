import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { HookService } from '../hooks/hook.service';
import { CORE_HOOKS } from '../hooks/hook.constants';
import { JwtPayload, BUILTIN_ROLE_PERMISSIONS } from '@vla/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly hooks: HookService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new UnauthorizedException('Use Google login for this account');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    let isNew = false;
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      user = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            googleId: profile.googleId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            role: 'STAFF',
            isActive: true,
          },
        });
        isNew = true;
      }
    }

    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    await this.hooks.doAction(CORE_HOOKS.AUTH_GOOGLE_LOGIN, { user, isNew });

    return user;
  }

  async impersonate(adminId: string, targetUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (!target.isActive) throw new ForbiddenException('Cannot impersonate an inactive user');
    if (target.role === 'ADMIN') throw new ForbiddenException('Cannot impersonate another admin');

    const permissions = await this.resolvePermissions(target.id, target.role);

    const payload: JwtPayload = {
      sub: target.id,
      email: target.email,
      role: target.role as any,
      permissions,
      impersonatedBy: adminId,
    };
    const token = this.jwtService.sign(payload, { expiresIn: '2h' });
    return { token, user: { id: target.id, email: target.email, firstName: target.firstName, lastName: target.lastName, role: target.role } };
  }

  async stopImpersonation(adminId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || admin.role !== 'ADMIN') throw new ForbiddenException('Invalid impersonation session');

    const permissions = await this.resolvePermissions(admin.id, admin.role);
    const payload: JwtPayload = { sub: admin.id, email: admin.email, role: admin.role as any, permissions };
    const token = this.jwtService.sign(payload);
    return { token, user: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName, role: admin.role } };
  }

  private async resolvePermissions(userId: string, role: string): Promise<string[]> {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: true },
    });

    let base: string[];
    if (userRecord?.customRole) {
      base = (userRecord.customRole.permissions as string[]) ?? [];
    } else {
      base = (BUILTIN_ROLE_PERMISSIONS[role] ?? []) as string[];
    }

    // Allow plugins to inject additional permissions at login time.
    // The filter receives { permissions, userId, role } so plugins have full context.
    const result = await this.hooks.applyFilter(CORE_HOOKS.PERMISSIONS_EXTEND, { permissions: base, userId, role });
    return result.permissions;
  }

  async login(user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }) {
    const permissions = await this.resolvePermissions(user.id, user.role);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
      permissions,
    };

    const token = this.jwtService.sign(payload);

    await this.hooks.doAction(CORE_HOOKS.AUTH_LOGIN, { user, token });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
