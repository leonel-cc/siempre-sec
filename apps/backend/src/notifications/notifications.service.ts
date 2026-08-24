import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationPayload {
  title: string;
  message: string;
  cameraName?: string;
  timestamp?: string;
  snapshotPath?: string;
  videoPath?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    const enabled = this.config.get('WHATSAPP_ENABLED') === 'true';

    if (!enabled) {
      this.logger.log('WhatsApp notifications disabled, skipping');
      return false;
    }

    const apiToken = this.config.get('WHATSAPP_API_TOKEN');
    const phoneNumberId = this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const recipient = this.config.get('WHATSAPP_RECIPIENT_NUMBER');
    const apiVersion = this.config.get('WHATSAPP_API_VERSION', 'v17.0');

    if (!apiToken || !phoneNumberId || !recipient) {
      this.logger.warn('WhatsApp not configured properly');
      return false;
    }

    try {
      const message = this.formatMessage(payload);
      const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`WhatsApp API error: ${error}`);
        return false;
      }

      this.logger.log(`WhatsApp notification sent to ${recipient}`);
      return true;
    } catch (error) {
      this.logger.error(`WhatsApp send failed: ${error}`);
      return false;
    }
  }

  private formatMessage(payload: NotificationPayload): string {
    const lines = [
      '🚨 ALERTA DE SEGURIDAD',
      '',
      `Cámara: ${payload.cameraName || 'Desconocida'}`,
      `Hora: ${payload.timestamp || new Date().toISOString()}`,
      `Evento: ${payload.title}`,
      '',
      payload.message,
    ];
    return lines.join('\n');
  }
}
