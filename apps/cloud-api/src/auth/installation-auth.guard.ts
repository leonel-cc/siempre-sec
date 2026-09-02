import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reflector } from '@nestjs/core';
import { Installation } from '../entities/entities';
import { verifyEnrollmentSecret } from '../enrollment/enrollment.crypto';
import { AuthenticatedRequest } from './auth.types';
import { ALLOW_REVOKED_INSTALLATION_KEY, DEVICE_AUTH_KEY } from './auth.decorators';

@Injectable()
export class InstallationAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Installation) private readonly installations: Repository<Installation>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const deviceAuth = this.reflector.getAllAndOverride<boolean>(DEVICE_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!deviceAuth) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = /^Device ([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})$/i.exec(authorization ?? '');
    if (!match) {
      throw new UnauthorizedException('Device authorization required');
    }
    const installation = await this.installations.findOneBy({ id: match[1] });
    if (!installation || !verifyEnrollmentSecret(match[2], installation.secretHash)) {
      throw new UnauthorizedException('Invalid device credentials');
    }
    const allowRevoked = this.reflector.getAllAndOverride<boolean>(ALLOW_REVOKED_INSTALLATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (installation.revokedAt && !allowRevoked) {
      throw new UnauthorizedException('Installation has been revoked');
    }
    request.installation = installation;
    return true;
  }
}
