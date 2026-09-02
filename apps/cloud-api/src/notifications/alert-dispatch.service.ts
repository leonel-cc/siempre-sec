import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  CloudEvent,
  Installation,
  NotificationChannel,
  NotificationDelivery,
  PhoneRecipient,
} from '../entities/entities';
import { EventRecipientDto } from '../events/events.dto';
import { fingerprintPhone, normalizeE164 } from './phone.crypto';
import { disabledProviderMode, ProductionProviderDisabledError } from './provider-policy';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp.provider';

const DELIVERY_STALE_AFTER_MS = 30_000;

@Injectable()
export class AlertDispatchService {
  private readonly logger = new Logger(AlertDispatchService.name);
  private readonly fingerprintSecret: string;

  constructor(
    config: ConfigService,
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
    @InjectRepository(PhoneRecipient)
    private readonly storedRecipients: Repository<PhoneRecipient>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    private readonly audit: AuditService,
  ) {
    this.fingerprintSecret = config.get<string>('PHONE_FINGERPRINT_SECRET')
      ?? 'development-only-phone-fingerprint-secret';
  }

  async dispatch(
    event: CloudEvent,
    installation: Installation,
    recipients: EventRecipientDto[],
    cameraName: string,
  ): Promise<void> {
    if (!this.whatsapp.enabled) {
      try {
        disabledProviderMode(process.env.NODE_ENV);
      } catch (error) {
        if (error instanceof ProductionProviderDisabledError) {
          throw new ServiceUnavailableException('WhatsApp provider is required in production');
        }
        throw error;
      }
      return;
    }

    let failed = false;
    for (const submitted of recipients) {
      let phoneE164: string;
      try {
        phoneE164 = normalizeE164(submitted.phone);
      } catch {
        await this.skipRecipient(event, installation, submitted.recipientId, 'invalid_e164');
        continue;
      }

      const recipient = await this.storedRecipients.findOneBy({
        id: submitted.recipientId,
        installationId: installation.id,
        phoneFingerprint: fingerprintPhone(phoneE164, this.fingerprintSecret),
        enabled: true,
      });
      if (!recipient?.verifiedAt) {
        await this.skipRecipient(event, installation, submitted.recipientId, 'not_eligible');
        continue;
      }

      let delivery: NotificationDelivery;
      try {
        const acquired = await this.acquireDelivery(event, recipient);
        if (!acquired) continue;
        delivery = acquired;
      } catch {
        failed = true;
        continue;
      }

      try {
        const result = await this.whatsapp.sendAlert(phoneE164, event.eventType, cameraName);
        delivery.status = 'SENT';
        delivery.providerMessageId = result.messageId;
        delivery.errorCode = null;
      } catch (error) {
        delivery.status = 'FAILED';
        delivery.errorCode = this.safeErrorCode(error);
        failed = true;
        this.logger.error(`WhatsApp alert failed for event ${event.id}, recipient ${recipient.id}`);
      }
      await this.deliveries.save(delivery);
    }

    if (failed) throw new ServiceUnavailableException('One or more WhatsApp alert deliveries failed');
  }

  private async acquireDelivery(
    event: CloudEvent,
    recipient: PhoneRecipient,
  ): Promise<NotificationDelivery | null> {
    let delivery = await this.deliveries.findOneBy({
      cloudEventId: event.id,
      channel: NotificationChannel.WHATSAPP,
      recipientId: recipient.id,
    });
    if (delivery?.status === 'SENT') return null;

    if (!delivery) {
      try {
        return await this.deliveries.save(this.deliveries.create({
          organizationId: event.organizationId,
          cloudEventId: event.id,
          channel: NotificationChannel.WHATSAPP,
          recipientId: recipient.id,
          phoneMask: recipient.phoneMask,
          status: 'PENDING',
          providerMessageId: null,
          errorCode: null,
        }));
      } catch (error) {
        if (error instanceof QueryFailedError
          && (error.driverError as { code?: string }).code === '23505') {
          throw new ServiceUnavailableException('WhatsApp alert delivery is already in progress');
        }
        throw error;
      }
    }

    const criteria = delivery.status === 'FAILED'
      ? { id: delivery.id, status: 'FAILED' }
      : {
        id: delivery.id,
        status: 'PENDING',
        updatedAt: LessThan(new Date(Date.now() - DELIVERY_STALE_AFTER_MS)),
      };
    const claimed = await this.deliveries.update(criteria, {
      status: 'PENDING',
      phoneMask: recipient.phoneMask,
      providerMessageId: null,
      errorCode: null,
    });
    if (!claimed.affected) {
      throw new ServiceUnavailableException('WhatsApp alert delivery is already in progress');
    }
    delivery.status = 'PENDING';
    delivery.phoneMask = recipient.phoneMask;
    delivery.providerMessageId = null;
    delivery.errorCode = null;
    return delivery;
  }

  private async skipRecipient(
    event: CloudEvent,
    installation: Installation,
    recipientId: string,
    reason: 'invalid_e164' | 'not_eligible',
  ): Promise<void> {
    this.logger.warn(`Skipped WhatsApp recipient ${recipientId} for event ${event.id}: ${reason}`);
    await this.audit.record({
      organizationId: installation.organizationId,
      actorInstallationId: installation.id,
      action: 'alert.recipient_skipped',
      targetType: 'phoneRecipient',
      targetId: recipientId,
      metadata: { cloudEventId: event.id, reason },
    });
  }

  private safeErrorCode(error: unknown): string {
    if (error && typeof error === 'object' && 'getStatus' in error
      && typeof error.getStatus === 'function') {
      return `HTTP_${String(error.getStatus())}`.slice(0, 100);
    }
    return error instanceof Error ? error.name.slice(0, 100) : 'UNKNOWN';
  }
}
