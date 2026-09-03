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
# Development only when custom templates are not approved yet:
WHATSAPP_DEMO_TEMPLATE_NAME=
```

Configure these values in `apps/cloud-api/.env`; no WhatsApp token or fixed recipient belongs in the local backend environment.

The approved authentication template used by the current integration must have one body variable for the six-digit code. The alert template must have two body variables in this order: event type and camera or installation name. `WHATSAPP_TEMPLATE_LANGUAGE` must exactly match the language approved by Meta.

For an initial Meta test-number demo without custom templates, set `WHATSAPP_DEMO_TEMPLATE_NAME=hello_world` while `NODE_ENV=development`. Alert and test sends then use Meta's `hello_world` template without components and force its required `en_US` language. Because `hello_world` cannot carry an OTP, the six-digit verification code is displayed only in the local Electron development UI. Demo mode is rejected outside development. This local-only mode may use the built-in development fingerprint secret; every non-demo or production environment still requires an independent `PHONE_FINGERPRINT_SECRET` of at least 32 characters.

## Multiple recipients

Each installation can verify and enable up to 100 phone numbers. Immediately before uploading an alert event, the local backend obtains the current `{ recipientId, phone }` pairs from the Electron parent. The E.164 values are transient: they are not written to the local outbox, event metadata, cloud event rows, delivery errors, audits, or logs.

Cloud validates each pair against the verified recipient fingerprint for that installation and sends one template per valid enabled recipient. Invalid pairs are omitted and audited without the number. Failed Meta calls leave the local event queued for retry, while successful per-recipient deliveries are not repeated.

## Recipient verification

Use the installation WhatsApp recipient endpoints documented in `apps/cloud-api/README.md`. Numbers must include `+` and their country code, for example `+14155552671`. Verification stores only a keyed fingerprint and display mask in cloud storage.

## Demo flow

The current demo uses installation-scoped contacts:

1. Start PostgreSQL, Cloud API, the web portal, and Electron.
2. Enroll Electron into an organization from **Settings > Cloud and remote access**.
3. Open the dedicated **Alerts** page and enter a contact name and an E.164 number.
4. Enter the six-digit code received through WhatsApp, or the local development code shown when using `hello_world` demo mode.
5. Keep the verified contact enabled and select **Send test alert**.
6. Electron submits the E.164 value transiently; Cloud validates its installation, recipient ID, fingerprint, verification, and status before calling Meta.

The test endpoint is `POST /installations/me/whatsapp-recipients/:recipientId/test` with `{ "phone": "+14155552671" }`. It is device-authenticated and limited to three requests per minute. A successful response means Meta accepted the message and returns its message ID; delivery to the handset can still be inspected in Meta delivery status tooling.

The future organization/location contact model and alert access links are documented as target architecture in `context.procedimentions.txt`; they are not part of this demo.

Evidence remains local. The approved target uses a private S3-compatible relay for at most 24 hours, with MinIO in development and S3/R2-compatible storage in production. Proactive snapshot and clip delivery will require two approved Meta templates with `IMAGE` and `VIDEO` headers and is intentionally not implemented by the `hello_world` demo.

The Meta token, Phone Number ID, and recipient number are local demo data and must never be committed. A credential smoke test on 2026-09-03 confirmed that Meta accepted `hello_world`; no secret or complete recipient number was persisted in the repository.
