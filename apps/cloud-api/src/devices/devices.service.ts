import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CloudCamera, Installation, RemoteCommand } from '../entities/entities';
import { MEDIA_PROVIDER, MediaProvider } from '../media/media.provider';
import { AcknowledgeCommandDto, SyncCamerasDto } from './devices.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Installation) private readonly installations: Repository<Installation>,
    @InjectRepository(CloudCamera) private readonly cameras: Repository<CloudCamera>,
    @InjectRepository(RemoteCommand) private readonly commands: Repository<RemoteCommand>,
    @Inject(MEDIA_PROVIDER) private readonly media: MediaProvider,
    private readonly audit: AuditService,
  ) {}

  async heartbeat(installation: Installation) {
    installation.lastHeartbeatAt = new Date();
    await this.installations.save(installation);
    return { receivedAt: installation.lastHeartbeatAt };
  }

  async revoke(installation: Installation, actorUserId?: string) {
    installation.revokedAt = new Date();
    await this.installations.save(installation);
    await this.audit.record({
      organizationId: installation.organizationId,
      actorUserId: actorUserId ?? null,
      actorInstallationId: actorUserId ? null : installation.id,
      action: 'installation.revoked',
      targetType: 'installation',
      targetId: installation.id,
    });
    const cameras = await this.cameras.findBy({ installationId: installation.id });
    for (const camera of cameras) {
      if (camera.ingressId) await this.media.deletePublisherIngress(camera.ingressId);
      camera.ingressId = null;
      camera.ingressUrl = null;
      camera.ingressStreamKey = null;
      camera.enabled = false;
      await this.cameras.save(camera);
    }
    return { revoked: true };
  }

  listInstallations(organizationId: string) {
    return this.installations.find({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        platform: true,
        lastHeartbeatAt: true,
        revokedAt: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async revokeByOrganization(organizationId: string, installationId: string, actorUserId: string) {
    const installation = await this.installations.findOneBy({ id: installationId, organizationId });
    if (!installation) throw new NotFoundException('Installation not found');
    return this.revoke(installation, actorUserId);
  }

  async syncCameras(installation: Installation, dto: SyncCamerasDto) {
    const localCameraIds = dto.cameras.map(camera => camera.localCameraId);
    await this.cameras.update(
      localCameraIds.length
        ? { installationId: installation.id, localCameraId: Not(In(localCameraIds)) }
        : { installationId: installation.id },
      { enabled: false },
    );
    for (const camera of dto.cameras) {
      await this.cameras.upsert(
        {
          organizationId: installation.organizationId,
          installationId: installation.id,
          localCameraId: camera.localCameraId,
          displayName: camera.displayName,
          capabilities: { ...camera.capabilities },
          enabled: camera.enabled,
        },
        { conflictPaths: ['installationId', 'localCameraId'] },
      );
    }
    return { synced: dto.cameras.length };
  }

  pendingCommands(installation: Installation) {
    return this.commands.find({
      where: {
        installationId: installation.id,
        status: 'PENDING',
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: 20,
    });
  }

  async acknowledgeCommand(
    installation: Installation,
    commandId: string,
    dto: AcknowledgeCommandDto,
  ) {
    const result = await this.commands.update(
      { id: commandId, installationId: installation.id, status: 'PENDING' },
      {
        status: dto.status,
        error: dto.status === 'FAILED' ? dto.error ?? 'Unknown device error' : null,
        acknowledgedAt: new Date(),
      },
    );
    if (result.affected) return { acknowledged: true, status: dto.status };
    const command = await this.commands.findOneBy({ id: commandId, installationId: installation.id });
    return command
      ? { acknowledged: true, status: command.status }
      : { acknowledged: false };
  }
}
