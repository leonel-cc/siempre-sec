import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WhatsAppSendResult {
  messageId: string | null;
}

export interface WhatsAppProvider {
  readonly enabled: boolean;
  readonly authenticationEnabled: boolean;
  sendAuthenticationCode(phoneE164: string, code: string): Promise<WhatsAppSendResult>;
  sendAlert(phoneE164: string, eventType: string, cameraName: string): Promise<WhatsAppSendResult>;
}

export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

interface MetaResponse {
  messages?: Array<{ id?: string }>;
  error?: { code?: number; message?: string };
}

@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly enabled: boolean;
  readonly authenticationEnabled: boolean;
  private readonly demoTemplateName: string;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('WHATSAPP_ENABLED') === 'true';
    this.demoTemplateName = this.config.get<string>('WHATSAPP_DEMO_TEMPLATE_NAME')?.trim() ?? '';
    this.authenticationEnabled = this.enabled
      && !this.demoTemplateName
      && Boolean(this.config.get<string>('WHATSAPP_AUTH_TEMPLATE_NAME'));
  }

  sendAuthenticationCode(phoneE164: string, code: string): Promise<WhatsAppSendResult> {
    return this.sendTemplate(phoneE164, this.config.getOrThrow('WHATSAPP_AUTH_TEMPLATE_NAME'), [code]);
  }

  sendAlert(phoneE164: string, eventType: string, cameraName: string): Promise<WhatsAppSendResult> {
    const demoTemplate = this.demoTemplateName;
    if (demoTemplate) {
      return this.sendTemplate(
        phoneE164,
        demoTemplate,
        [],
        demoTemplate === 'hello_world' ? 'en_US' : undefined,
      );
    }
    return this.sendTemplate(phoneE164, this.config.getOrThrow('WHATSAPP_ALERT_TEMPLATE_NAME'), [
      eventType,
      cameraName,
    ]);
  }

  private async sendTemplate(
    phoneE164: string,
    templateName: string,
    bodyParameters: string[],
    languageOverride?: string,
  ): Promise<WhatsAppSendResult> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('WhatsApp provider is disabled');
    }
    const token = this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const version = this.config.get<string>('WHATSAPP_API_VERSION', 'v20.0');
    const language = languageOverride ?? this.config.get<string>('WHATSAPP_TEMPLATE_LANGUAGE', 'en_US');
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneE164.slice(1),
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          ...(bodyParameters.length ? { components: [
            {
              type: 'body',
              parameters: bodyParameters.map((text) => ({ type: 'text', text })),
            },
          ] } : {}),
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = (await response.json()) as MetaResponse;
    if (!response.ok) {
      throw new ServiceUnavailableException(`Meta Cloud API rejected template (${payload.error?.code ?? response.status})`);
    }
    return { messageId: payload.messages?.[0]?.id ?? null };
  }
}
