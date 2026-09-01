import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CloudCamera, CloudEvent, Installation } from '../entities/entities';
import { AlertDispatchService } from '../notifications/alert-dispatch.service';
import { assertNoCameraSecrets } from '../security/sensitive-data';
import { EventListQueryDto, IngestEventDto } from './events.dto';

const ALERT_EVENT_TYPES = new Set(['WEAPON_DETECTED', 'FACE_COVERED']);

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(CloudEvent) private readonly events: Repository<CloudEvent>,
    @InjectRepository(CloudCamera) private readonly cameras: Repository<CloudCamera>,
    private readonly alerts: AlertDispatchService,
  ) {}

  async ingest(installation: Installation, dto: IngestEventDto): Promise<CloudEvent> {
    assertNoCameraSecrets(dto.metadata);
    const camera = dto.localCameraId
      ? await this.cameras.findOneBy({ installationId: installation.id, localCameraId: dto.localCameraId })
      : null;
    if (dto.localCameraId && !camera) {
      throw new BadRequestException('Camera does not belong to this installation');
    }

    let event: CloudEvent;
    try {
      event = await this.events.save(
        this.events.create({
          organizationId: installation.organizationId,
          installationId: installation.id,
          cloudCameraId: camera?.id ?? null,
          localEventId: dto.localEventId,
          eventType: dto.eventType,
          occurredAt: new Date(dto.occurredAt),
          metadata: dto.metadata,
        }),
      );
    } catch (error) {
      if (!(error instanceof QueryFailedError) || (error.driverError as { code?: string }).code !== '23505') {
        throw error;
      }
      event = await this.events.findOneByOrFail({
        installationId: installation.id,
        localEventId: dto.localEventId,
      });
    }

    if (ALERT_EVENT_TYPES.has(event.eventType)) {
      await this.alerts.dispatch(event);
    }
    return event;
  }

  list(organizationId: string, query: EventListQueryDto): Promise<CloudEvent[]> {
    return this.events.find({
      where: { organizationId, ...(query.cameraId ? { cloudCameraId: query.cameraId } : {}) },
      order: { occurredAt: 'DESC' },
      take: 100,
    });
  }
}
