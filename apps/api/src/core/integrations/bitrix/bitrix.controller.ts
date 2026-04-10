import { Controller, Get, Post, Delete, Body, Query, Res, Header, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { BitrixService } from './bitrix.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@vla/shared';

@Controller('admin/integrations/bitrix')
export class BitrixController {
  constructor(
    private readonly bitrix: BitrixService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getStatus() {
    return this.bitrix.getStatus();
  }

  @Post('configure')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async configure(
    @Body() body: { clientId: string; clientSecret: string; domain: string },
  ) {
    const { clientId, clientSecret, domain } = body;
    if (!clientId || !clientSecret || !domain) {
      return { error: 'clientId, clientSecret y domain son requeridos' };
    }
    await this.bitrix.saveAppConfig({
      clientId,
      clientSecret,
      domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    });
    return { ok: true };
  }

  @Get('authorize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  authorize(@Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL')!;
    const redirectUri = `${frontendUrl}/api/v1/admin/integrations/bitrix/callback`;
    const url = this.bitrix.getAuthorizeUrl(redirectUri);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL')!;
    const redirectUri = `${frontendUrl}/api/v1/admin/integrations/bitrix/callback`;
    try {
      await this.bitrix.handleOAuthCallback(code, redirectUri);
      // Redirect to admin integrations page with success
      res.redirect(`${frontendUrl}/dashboard/admin?tab=integrations&bitrix=connected`);
    } catch (e: any) {
      res.redirect(`${frontendUrl}/dashboard/admin?tab=integrations&bitrix=error&msg=${encodeURIComponent(e.message)}`);
    }
  }

  @Post('test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async test() {
    try {
      const user = await this.bitrix.call<any>('user.current');
      return {
        ok: true,
        user: `${user.NAME} ${user.LAST_NAME} (ID: ${user.ID})`,
        domain: this.bitrix.getStatus().domain,
      };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async disconnect() {
    await this.bitrix.disconnect();
    return { ok: true };
  }
}
