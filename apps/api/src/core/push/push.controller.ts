import { BadRequestException, Body, Controller, Delete, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService } from './push.service';

class PushKeysDto {
  @IsString() @IsNotEmpty() p256dh!: string;
  @IsString() @IsNotEmpty() auth!: string;
}

class SubscribeDto {
  @IsString() @IsNotEmpty() endpoint!: string;
  @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() @IsNotEmpty() endpoint!: string;
}

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('subscribe')
  async subscribe(@Req() req: any, @Body() body: SubscribeDto) {
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      throw new BadRequestException('endpoint and keys (p256dh, auth) are required');
    }
    await this.push.subscribe(req.user.id, body.endpoint, body.keys.p256dh, body.keys.auth);
    return { ok: true };
  }

  @Delete('subscribe')
  @HttpCode(200)
  async unsubscribe(@Req() req: any, @Body() body: UnsubscribeDto) {
    if (!body?.endpoint) {
      throw new BadRequestException('endpoint is required');
    }
    await this.push.unsubscribeForUser(body.endpoint, req.user.id);
    return { ok: true };
  }
}
