import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentInstallation, CurrentUserParam, DeviceAuth, Public, Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.types';
import { Installation, MembershipRole } from '../entities/entities';
import { Throttle } from '@nestjs/throttler';
import { ConfirmPhoneVerificationDto, RequestPhoneVerificationDto } from './phone.dto';
import { PhoneVerificationService } from './phone-verification.service';

@Public()
@DeviceAuth()
@Controller('installations/me/whatsapp-recipients')
export class DevicePhoneRecipientsController {
  constructor(private readonly verification: PhoneVerificationService) {}

  @Get()
  list(@CurrentInstallation() installation: Installation) {
    return this.verification.listForInstallation(installation);
  }

  @Post('verification/request')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@CurrentInstallation() installation: Installation, @Body() dto: RequestPhoneVerificationDto) {
    return this.verification.request(installation, dto);
  }

  @Post('verification/confirm')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirm(@CurrentInstallation() installation: Installation, @Body() dto: ConfirmPhoneVerificationDto) {
    return this.verification.confirm(installation, dto);
  }

  @Post(':recipientId/activate')
  activate(@CurrentInstallation() installation: Installation, @Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.verification.setEnabledByInstallation(installation, recipientId, true);
  }

  @Post(':recipientId/deactivate')
  deactivate(@CurrentInstallation() installation: Installation, @Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.verification.setEnabledByInstallation(installation, recipientId, false);
  }

  @Delete(':recipientId')
  @HttpCode(204)
  remove(@CurrentInstallation() installation: Installation, @Param('recipientId', ParseUUIDPipe) recipientId: string) {
    return this.verification.deleteByInstallation(installation, recipientId);
  }
}

@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@Controller('organizations/:organizationId/whatsapp-recipients')
export class OrganizationPhoneRecipientsController {
  constructor(private readonly verification: PhoneVerificationService) {}

  @Get()
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.verification.listForOrganization(organizationId);
  }

  @Post(':recipientId/activate')
  activate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.verification.setEnabledByOrganization(organizationId, recipientId, true, user);
  }

  @Post(':recipientId/deactivate')
  deactivate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.verification.setEnabledByOrganization(organizationId, recipientId, false, user);
  }

  @Delete(':recipientId')
  @HttpCode(204)
  remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.verification.deleteByOrganization(organizationId, recipientId, user);
  }
}
