import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  AllowRevokedInstallation,
  CurrentInstallation,
  CurrentUserParam,
  DeviceAuth,
  Public,
  Roles,
} from '../auth/auth.decorators';
import { Installation, MembershipRole } from '../entities/entities';
import { CurrentUser } from '../auth/auth.types';
import { AcknowledgeCommandDto, SyncCamerasDto } from './devices.dto';
import { DevicesService } from './devices.service';

@Public()
@DeviceAuth()
@Controller('installations/me')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('heartbeat')
  heartbeat(@CurrentInstallation() installation: Installation) {
    return this.devices.heartbeat(installation);
  }

  @Post('revoke')
  @AllowRevokedInstallation()
  revoke(@CurrentInstallation() installation: Installation) {
    return this.devices.revoke(installation);
  }

  @Post('cameras/sync')
  sync(@CurrentInstallation() installation: Installation, @Body() dto: SyncCamerasDto) {
    return this.devices.syncCameras(installation, dto);
  }

  @Get('commands')
  commands(@CurrentInstallation() installation: Installation) {
    return this.devices.pendingCommands(installation);
  }

  @Post('commands/:commandId/ack')
  acknowledge(
    @CurrentInstallation() installation: Installation,
    @Param('commandId', ParseUUIDPipe) commandId: string,
    @Body() dto: AcknowledgeCommandDto,
  ) {
    return this.devices.acknowledgeCommand(installation, commandId, dto);
  }
}

@Controller('organizations/:organizationId/installations')
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
export class InstallationAdminController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.devices.listInstallations(organizationId);
  }

  @Post(':installationId/revoke')
  revoke(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('installationId', ParseUUIDPipe) installationId: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.devices.revokeByOrganization(organizationId, installationId, user.id);
  }
}
