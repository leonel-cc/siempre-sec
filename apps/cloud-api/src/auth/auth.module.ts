import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installation, Membership, User } from '../entities/entities';
import { InstallationAuthGuard } from './installation-auth.guard';
import { OidcAuthGuard } from './oidc-auth.guard';
import { TenantRolesGuard } from './tenant-roles.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Membership, Installation])],
  providers: [
    InstallationAuthGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OidcAuthGuard },
    { provide: APP_GUARD, useClass: TenantRolesGuard },
  ],
  exports: [InstallationAuthGuard],
})
export class AuthModule {}
