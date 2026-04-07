import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { HookService } from '../hooks/hook.service';
import { CORE_HOOKS } from '../hooks/hook.constants';
import { JwtPayload } from '@vla/shared';

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

  async login(user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as any,
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
