import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import {
  CloudCamera,
  CloudEvent,
  NotificationChannel,
  NotificationDelivery,
  PhoneRecipient,
} from '../entities/entities';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp.provider';

@Injectable()
export class AlertDispatchService {
  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
    @InjectRepository(PhoneRecipient) private readonly recipients: Repository<PhoneRecipient>,
    @InjectRepository(CloudCamera) private readonly cameras: Repository<CloudCamera>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
  ) {}

  async dispatch(event: CloudEvent): Promise<void> {
    if (!this.whatsapp.enabled) return;
    const recipient = await this.recipients.findOneBy({ organizationId: event.organizationId });
    if (!recipient?.verifiedAt) {
      throw new ServiceUnavailableException('No verified WhatsApp recipient is configured');
    }

    let delivery = await this.deliveries.findOneBy({
      cloudEventId: event.id,
      channel: NotificationChannel.WHATSAPP,
    });
    if (!delivery) {
      try {
        delivery = await this.deliveries.save(this.deliveries.create({
          organizationId: event.organizationId,
          cloudEventId: event.id,
          channel: NotificationChannel.WHATSAPP,
          status: 'PENDING',
          providerMessageId: null,
          errorCode: null,
        }));
      } catch (error) {
        if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
          throw new ServiceUnavailableException('WhatsApp alert delivery is already in progress');
        }
        throw error;
      }
    } else if (delivery.status === 'SENT') {
      return;
    } else if (delivery.status === 'PENDING') {
      const claimed = await this.deliveries.update(
        { id: delivery.id, status: 'PENDING', updatedAt: LessThan(new Date(Date.now() - 30_000)) },
        { status: 'PENDING', errorCode: null },
      );
      if (!claimed.affected) {
        throw new ServiceUnavailableException('WhatsApp alert delivery is still in progress');
      }
      delivery.errorCode = null;
    } else if (delivery.status === 'FAILED') {
      const claimed = await this.deliveries.update(
        { id: delivery.id, status: 'FAILED' },
        { status: 'PENDING', errorCode: null },
      );
      if (!claimed.affected) return;
      delivery.status = 'PENDING';
      delivery.errorCode = null;
    }

    try {
      const camera = event.cloudCameraId ? await this.cameras.findOneBy({ id: event.cloudCameraId }) : null;
      const result = await this.whatsapp.sendAlert(
        recipient.phoneE164,
        event.eventType,
        camera?.displayName ?? 'Unknown camera',
      );
      delivery.status = 'SENT';
      delivery.providerMessageId = result.messageId;
    } catch (error) {
      delivery.status = 'FAILED';
      delivery.errorCode = error instanceof Error ? error.message.slice(0, 100) : 'UNKNOWN';
      await this.deliveries.save(delivery);
      throw new ServiceUnavailableException('WhatsApp alert delivery failed');
    }
    await this.deliveries.save(delivery);
  }
}
