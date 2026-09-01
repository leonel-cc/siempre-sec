import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { Repository } from 'typeorm';
import { Membership, User } from '../entities/entities';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class OidcAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
  ) {
    this.issuer = this.config.getOrThrow<string>('OIDC_ISSUER');
    this.audience = this.config.getOrThrow<string>('OIDC_AUDIENCE');
    this.jwks = createRemoteJWKSet(new URL(this.config.getOrThrow<string>('OIDC_JWKS_URI')));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }

    try {
      const verified = await jwtVerify(authorization.slice(7), this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      request.user = await this.upsertUser(verified.payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid bearer token');
    }
  }

  private async upsertUser(payload: JWTPayload): Promise<User> {
    if (!payload.iss || !payload.sub) {
      throw new UnauthorizedException('Token requires issuer and subject');
    }
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
    const emailVerified = payload.email_verified === true;
    const displayName = typeof payload.name === 'string' ? payload.name.slice(0, 160) : null;

    await this.users
      .createQueryBuilder()
      .insert()
      .values({ issuer: payload.iss, subject: payload.sub, email, emailVerified, displayName })
      .orUpdate(['email', 'emailVerified', 'displayName'], ['issuer', 'subject'])
      .execute();

    const user = await this.users.findOneByOrFail({ issuer: payload.iss, subject: payload.sub });
    if (email && emailVerified) {
      await this.memberships.query(
        `UPDATE memberships AS pending
         SET user_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE pending.email = $2
           AND pending.user_id IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM memberships AS existing
             WHERE existing.organization_id = pending.organization_id
               AND existing.user_id = $1
           )`,
        [user.id, email],
      );
    }
    return user;
  }
}
