import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership, MembershipRole } from '../entities/entities';
import { ROLES_KEY } from './auth.decorators';
import { AuthenticatedRequest } from './auth.types';
import { hasAnyRole } from './permissions';

@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = request.params.organizationId ?? this.readOrganizationId(request.body);
    if (!request.user || !organizationId) {
      throw new ForbiddenException('Organization context required');
    }
    const membership = await this.memberships.findOneBy({ organizationId, userId: request.user.id });
    if (!membership || !hasAnyRole(membership.role, roles)) {
      throw new ForbiddenException('Insufficient organization role');
    }
    return true;
  }

  private readOrganizationId(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null || !('organizationId' in body)) {
      return undefined;
    }
    return typeof body.organizationId === 'string' ? body.organizationId : undefined;
  }
}
