import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../guards/permissions.guard';
import { Permission } from '@vla/shared';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
