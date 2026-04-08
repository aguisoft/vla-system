import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { UserRole } from '@vla/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LogBuffer, LogEntry } from './log-buffer';

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system')
export class LogBufferController {
  @ApiOperation({ summary: 'Get recent log entries (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('logs')
  getLogs(@Query('limit') limit?: string): { entries: LogEntry[] } {
    const parsed = limit ? parseInt(limit, 10) : 200;
    return { entries: LogBuffer.getEntries(isNaN(parsed) ? 200 : parsed) };
  }

  @ApiOperation({ summary: 'SSE stream of live log entries (admin only)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('logs/stream')
  streamLogs(@Req() req: Request, @Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    LogBuffer.subscribe(res);

    req.on('close', () => {
      LogBuffer.unsubscribe(res);
    });
  }
}
