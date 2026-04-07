import {
  Controller, Post, UseGuards, Request, Body,
  Get, Res, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
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
  ) {}

  @ApiOperation({ summary: 'Login with email & password' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.authService.login(req.user);
    res.cookie('vla_token', access_token, COOKIE_OPTIONS);
    return { user };
  }

  @ApiOperation({ summary: 'Logout — clears auth cookie' })
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('vla_token', { path: '/' });
    return { ok: true };
  }

  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: any) {
    return req.user;
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
    if (!req.user) throw new UnauthorizedException();
    const user = await this.authService.findOrCreateGoogleUser(req.user);
    const { access_token } = await this.authService.login(user);
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL');

    // Set httpOnly cookie — NO token in URL
    res.cookie('vla_token', access_token, COOKIE_OPTIONS);
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
