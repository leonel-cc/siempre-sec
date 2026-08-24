import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { CreateEventDto } from '@security-ai/shared';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CamerasService } from '../cameras/cameras.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly websocketGateway: WebsocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly camerasService: CamerasService,
  ) {}

  async findAll(limit = 50, offset = 0): Promise<Event[]> {
    return this.eventRepo.find({
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['camera'],
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['camera'],
    });
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }

  async create(dto: CreateEventDto): Promise<Event> {
    const event = this.eventRepo.create({
      cameraId: dto.camera_id,
      eventType: dto.event_type,
      timestamp: dto.timestamp,
      confidence: dto.confidence,
      personId: dto.person_id,
      trackingId: dto.tracking_id,
      zoneId: dto.zone_id,
      snapshotPath: dto.snapshot_path,
      videoPath: dto.video_path,
      status: dto.status || 'NEW',
      metadata: dto.metadata ? JSON.stringify(dto.metadata) : undefined,
    });
    const saved = await this.eventRepo.save(event);

    this.websocketGateway.broadcastEvent({
      id: saved.id,
      event_type: saved.eventType,
      camera_id: saved.cameraId,
      timestamp: saved.timestamp,
      status: saved.status,
      confidence: saved.confidence,
    });

    const isSecurityAlert = ['SECURITY_ALERT', 'RESTRICTED_ZONE', 'UNKNOWN_PERSON'].includes(saved.eventType);
    if (isSecurityAlert) {
      this.websocketGateway.broadcastAlert({
        id: saved.id,
        event_type: saved.eventType,
        camera_id: saved.cameraId,
        timestamp: saved.timestamp,
        message: `Alerta de seguridad: ${saved.eventType}`,
        confidence: saved.confidence,
        video_path: saved.videoPath,
        snapshot_path: saved.snapshotPath,
        severity: saved.metadata ? JSON.parse(saved.metadata).severity : 'MEDIUM',
        rule_name: saved.metadata ? JSON.parse(saved.metadata).rule_name : '',
      });

      let cameraName = 'Desconocida';
      try {
        const camera = await this.camerasService.findOne(saved.cameraId);
        cameraName = camera.name;
      } catch {}

      this.notificationsService.send({
        title: saved.eventType,
        message: `Confianza: ${(saved.confidence * 100).toFixed(1)}%`,
        cameraName,
        timestamp: saved.timestamp || new Date().toISOString(),
        videoPath: saved.videoPath,
      }).catch(err => this.logger.error(`WhatsApp notification failed: ${err}`));
    }

    return saved;
  }

  async updateStatus(id: string, status: string): Promise<Event> {
    const event = await this.findOne(id);
    event.status = status;
    return this.eventRepo.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepo.remove(event);
  }

  async countToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.eventRepo
      .createQueryBuilder('event')
      .where('event.created_at >= :today', { today: today.toISOString() })
      .getCount();
  }
}
