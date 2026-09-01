import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/auth.types';
import { CloudCamera, Installation, RemoteCommand } from '../entities/entities';
import { MEDIA_PROVIDER, MediaProvider } from './media.provider';

@Injectable()
export class ViewSessionsService {
  constructor(
    @InjectRepository(CloudCamera) private readonly cameras: Repository<CloudCamera>,
    @InjectRepository(Installation) private readonly installations: Repository<Installation>,
    @InjectRepository(RemoteCommand) private readonly commands: Repository<RemoteCommand>,
    @Inject(MEDIA_PROVIDER) private readonly media: MediaProvider,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, cameraId: string, user: CurrentUser) {
    const camera = await this.cameras.findOneBy({ id: cameraId, organizationId, enabled: true });
    if (!camera) {
      throw new NotFoundException('Camera not found');
    }
    const installation = await this.installations.findOneBy({ id: camera.installationId, organizationId });
    const online = installation?.lastHeartbeatAt
      && installation.lastHeartbeatAt.getTime() > Date.now() - 120_000;
    if (!installation || installation.revokedAt || !online) {
      throw new ServiceUnavailableException('Camera installation is offline');
    }
    const roomName = `org_${organizationId}_camera_${camera.id}`;
    if (!camera.ingressId || !camera.ingressUrl || !camera.ingressStreamKey) {
      const ingress = await this.media.createPublisherIngress(
        roomName,
        `installation_${camera.installationId}_camera_${camera.id}`,
      );
      camera.ingressId = ingress.ingressId;
      camera.ingressUrl = ingress.url;
      camera.ingressStreamKey = ingress.streamKey;
      await this.cameras.save(camera);
    }
    await this.commands.save(this.commands.create({
      organizationId,
      installationId: camera.installationId,
      type: 'START_LIVE',
      payload: {
        localCameraId: camera.localCameraId,
        publishUrl: camera.ingressUrl,
        streamKey: camera.ingressStreamKey,
        publisherTtlSeconds: 5 * 60,
      },
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      acknowledgedAt: null,
      error: null,
    }));
    const session = await this.media.createSubscribeSession(roomName, `user_${user.id}`);
    await this.audit.record({
      organizationId,
      actorUserId: user.id,
      action: 'camera.view_session_created',
      targetType: 'cloudCamera',
      targetId: camera.id,
    });
    return {
      provider: 'livekit',
      url: session.serverUrl,
      roomName: session.roomName,
      token: session.token,
      expiresAt: new Date(Date.now() + session.expiresInSeconds * 1000).toISOString(),
    };
  }
}
