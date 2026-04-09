import {
  Controller, Post, UseGuards, Request, Body,
  Get, Res, Param, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@vla/shared';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Login with email & password' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.authService.login(req.user);
    res.cookie('vla_token', access_token, COOKIE_OPTIONS);
    return { user };
  }

  @ApiOperation({ summary: 'Logout — clears auth cookie' })
  @SkipThrottle()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('vla_token', { path: '/' });
    return { ok: true };
  }

  @ApiOperation({ summary: 'Get current authenticated user' })
  @SkipThrottle()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const userId = req.user.sub ?? req.user.id;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    return {
      id: user?.id ?? userId,
      email: user?.email ?? req.user.email,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      role: user?.role ?? req.user.role,
      permissions: req.user.permissions ?? [],
      isImpersonated: !!req.user.impersonatedBy,
    };
  }

  @ApiOperation({ summary: 'Impersonate a user (Admin only)' })
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('impersonate/:id')
  async impersonate(
    @Param('id') targetId: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user.impersonatedBy) throw new ForbiddenException('Cannot impersonate while already impersonating');
    const { token, user } = await this.authService.impersonate(req.user.id, targetId);
    (res as any).cookie('vla_token', token, { ...COOKIE_OPTIONS, maxAge: 2 * 60 * 60 * 1000 });
    return { user, impersonatedBy: req.user.id };
  }

  @ApiOperation({ summary: 'Stop impersonation, return to admin session' })
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Post('impersonate/stop')
  async stopImpersonation(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    if (!req.user.impersonatedBy) throw new ForbiddenException('Not in an impersonation session');
    const { token, user } = await this.authService.stopImpersonation(req.user.impersonatedBy);
    (res as any).cookie('vla_token', token, COOKIE_OPTIONS);
    return { user };
  }

  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleLogin() {
    // Passport redirects to Google — no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(
    @Request() req: any,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL');

    if (!req.user) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Error de autenticación')}`);
    }

    try {
      const user = await this.authService.findOrCreateGoogleUser(req.user);
      const { access_token } = await this.authService.login(user);
      res.cookie('vla_token', access_token, COOKIE_OPTIONS);
      res.redirect(`${frontendUrl}/auth/callback`);
    } catch (e: any) {
      const msg = e.message ?? 'No tienes acceso al sistema';
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }
}
