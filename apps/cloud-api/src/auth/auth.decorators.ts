import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Installation, MembershipRole } from '../entities/entities';
import { AuthenticatedRequest, CurrentUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'organizationRoles';
export const ALLOW_REVOKED_INSTALLATION_KEY = 'allowRevokedInstallation';
export const DEVICE_AUTH_KEY = 'deviceAuth';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
export const AllowRevokedInstallation = () => SetMetadata(ALLOW_REVOKED_INSTALLATION_KEY, true);
export const DeviceAuth = () => SetMetadata(DEVICE_AUTH_KEY, true);

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new Error('Current user was not populated');
    }
    return request.user;
  },
);

export const CurrentInstallation = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Installation => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.installation) {
      throw new Error('Current installation was not populated');
    }
    return request.installation;
  },
);
