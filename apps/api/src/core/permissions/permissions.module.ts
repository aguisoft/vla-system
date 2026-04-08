import { Module } from '@nestjs/common';
import { PermissionsRegistryService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

@Module({
  providers: [PermissionsRegistryService],
  controllers: [PermissionsController],
  exports: [PermissionsRegistryService],
})
export class PermissionsModule {}
