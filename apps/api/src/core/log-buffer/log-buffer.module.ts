import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { LogBufferController } from './log-buffer.controller';

@Module({
  imports: [AuthModule, RolesModule],
  controllers: [LogBufferController],
})
export class LogBufferModule {}
