import { Controller, Post, UseGuards, Request, Body, Get, Redirect, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Login' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Get current user' })
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
    // Passport redirects to Google
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Request() req: any, @Res() res: Response) {
    const user = await this.authService.findOrCreateGoogleUser(req.user);
    const { access_token } = await this.authService.login(user);
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }));
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}&user=${userData}`);
  }
}
