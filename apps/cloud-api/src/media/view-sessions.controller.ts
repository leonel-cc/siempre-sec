import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserParam, Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.types';
import { CloudCamera, Installation, MembershipRole } from '../entities/entities';
import { ViewSessionsService } from './view-sessions.service';

@Roles(
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.OPERATOR,
  MembershipRole.VIEWER,
)
@Controller('organizations/:organizationId/cameras')
export class ViewSessionsController {
  constructor(
    private readonly sessions: ViewSessionsService,
    @InjectRepository(CloudCamera) private readonly cameras: Repository<CloudCamera>,
    @InjectRepository(Installation) private readonly installations: Repository<Installation>,
  ) {}

  @Get()
  async list(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const cameras = await this.cameras.find({
      where: { organizationId },
      order: { displayName: 'ASC' },
    });
    const installationIds = [...new Set(cameras.map(camera => camera.installationId))];
    const installations = installationIds.length
      ? await this.installations.createQueryBuilder('installation')
        .where('installation.id IN (:...installationIds)', { installationIds })
        .getMany()
      : [];
    const installationStatus = new Map(installations.map(item => [item.id, item]));
    return cameras.map(camera => {
      const installation = installationStatus.get(camera.installationId);
      const lastSeenAt = installation?.lastHeartbeatAt ?? null;
      return {
        id: camera.id,
        organizationId: camera.organizationId,
        installationId: camera.installationId,
        localCameraId: camera.localCameraId,
        displayName: camera.displayName,
        capabilities: camera.capabilities,
        enabled: camera.enabled,
        online: Boolean(
          !installation?.revokedAt
          && lastSeenAt
          && lastSeenAt.getTime() > Date.now() - 120_000,
        ),
        lastSeenAt: lastSeenAt?.toISOString() ?? null,
      };
    });
  }

  @Post(':cameraId/view-sessions')
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('cameraId', ParseUUIDPipe) cameraId: string,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.sessions.create(organizationId, cameraId, user);
  }
}
