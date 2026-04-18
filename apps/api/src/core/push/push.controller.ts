import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService } from './push.service';

class SubscribeDto {
  endpoint!: string;
  keys!: { p256dh: string; auth: string };
}

class UnsubscribeDto {
  endpoint!: string;
}

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('subscribe')
  async subscribe(@Req() req: any, @Body() body: SubscribeDto) {
    await this.push.subscribe(req.user.id, body.endpoint, body.keys.p256dh, body.keys.auth);
    return { ok: true };
  }

  @Delete('subscribe')
  async unsubscribe(@Body() body: UnsubscribeDto) {
    await this.push.unsubscribe(body.endpoint);
    return { ok: true };
  }
}
