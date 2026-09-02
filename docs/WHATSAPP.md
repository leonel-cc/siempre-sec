# WhatsApp Integration

## Overview

Security AI sends `WEAPON_DETECTED` and `FACE_COVERED` alerts through approved Meta WhatsApp templates. Meta credentials exist only in Cloud API; the local backend does not call Meta directly.

## Cloud configuration

```env
WHATSAPP_ENABLED=true
PHONE_FINGERPRINT_SECRET=replace-with-at-least-32-random-characters
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v20.0
WHATSAPP_AUTH_TEMPLATE_NAME=siempre_verification_code
WHATSAPP_ALERT_TEMPLATE_NAME=siempre_security_alert
WHATSAPP_TEMPLATE_LANGUAGE=en_US
```

Configure these values in `apps/cloud-api/.env`; no WhatsApp token or fixed recipient belongs in the local backend environment.

## Multiple recipients

Each installation can verify and enable up to 100 phone numbers. Immediately before uploading an alert event, the local backend obtains the current `{ recipientId, phone }` pairs from the Electron parent. The E.164 values are transient: they are not written to the local outbox, event metadata, cloud event rows, delivery errors, audits, or logs.

Cloud validates each pair against the verified recipient fingerprint for that installation and sends one template per valid enabled recipient. Invalid pairs are omitted and audited without the number. Failed Meta calls leave the local event queued for retry, while successful per-recipient deliveries are not repeated.

## Recipient verification

Use the installation WhatsApp recipient endpoints documented in `apps/cloud-api/README.md`. Numbers must include `+` and their country code, for example `+14155552671`. Verification stores only a keyed fingerprint and display mask in cloud storage.
