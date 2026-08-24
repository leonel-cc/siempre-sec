# WhatsApp Integration

## Overview

Security AI sends alert notifications via WhatsApp Business Platform API (official).

## Setup

### 1. Create WhatsApp Business Account

1. Go to [business.facebook.com](https://business.facebook.com)
2. Create a WhatsApp Business account
3. Get a phone number for the business

### 2. Create Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app
3. Add WhatsApp product
4. Get the API token and Phone Number ID

### 3. Configure Environment

```env
WHATSAPP_ENABLED=true
WHATSAPP_API_TOKEN=your_api_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v17.0
WHATSAPP_RECIPIENT_NUMBER=5491155551234
```

### 4. Recipient Verification

The recipient number must be registered with WhatsApp. Send a test message from the WhatsApp Business API dashboard first.

## Alert Format

```
🚨 ALERTA DE SEGURIDAD

Cámara: Patio
Hora: 02:14:25
Evento: Persona desconocida en zona restringida

[snapshot image]
[video clip]
```

## Rate Limiting

- Cooldown period: 60 seconds (configurable)
- Same camera + same person = single alert
- Alert updates replace previous alerts for same tracking session

## Privacy

- WhatsApp notifications are **disabled by default**
- User must explicitly configure credentials
- Only alert-triggering events are sent
- All processing remains local; only notifications leave the device
- User can disable WhatsApp at any time

## Error Handling

- API failures are logged but don't affect detection pipeline
- Failed notifications are retried once
- Dashboard shows notification status (sent/failed)
