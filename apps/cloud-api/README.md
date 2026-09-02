# Cloud API

First control-plane slice for organizations, edge installation enrollment, camera metadata, cloud event indexing, remote LiveKit viewing, and WhatsApp recipient enrollment.

## Run

1. Create a PostgreSQL database and copy `.env.example` to `.env`.
2. Supply the OIDC issuer, audience, and JWKS URI.
3. From this directory, run `npm install` when dependency installation is desired.
4. Run `npm run start:dev`.

The API is served under `/v1`. Schema synchronization is used only for tests; versioned migrations run automatically when the API starts in other environments.

## Credentials and providers

- OIDC credentials/configuration are required for all user-authenticated routes. Bearer tokens are verified against the configured remote JWKS.
- Pending email invitations are linked only when the OIDC token supplies the matching email with `email_verified=true`.
- LiveKit URL, API key, and secret are required to create a remote view session. The API returns `503` if they are absent.
- Production requires WhatsApp to be enabled and fully configured. Meta Cloud API credentials and approved authentication/alert template names are required whenever it is enabled.
- `PHONE_FINGERPRINT_SECRET` must be an application-wide random secret of at least 32 characters in production or whenever WhatsApp is enabled. Rotating it invalidates phone matching and requires recipients to be verified again.
- With WhatsApp disabled, non-production verification requests return `developmentCode` and alert dispatch is omitted without creating failed deliveries. Production validation requires the provider to be enabled.
- Invitation persistence is implemented, but invitation email delivery is deliberately an adapter responsibility and is not included.

## Security boundaries and limitations

- Edge camera sync accepts metadata only. Camera passwords, credentials, and RTSP URLs are neither accepted nor stored.
- Installation secrets and enrollment device codes are returned once and persisted only as hashes.
- The MVP stores event metadata only. There is no cloud evidence upload, image storage, or video storage.
- Basic E.164 normalization is intentionally conservative and requires a leading country code. E.164 is accepted transiently by Device verification and event upload endpoints but only the contact name, display mask, and HMAC SHA-256 fingerprint are persisted.
- TypeORM synchronization is used only for tests; deployed schemas are managed by reviewed PostgreSQL migrations.
- The installation-recipient migration preserves verified legacy recipients by assigning them to the oldest non-revoked installation in their organization. Because their complete number cannot be transferred into local secure storage, they remain disabled and visibly require verification again. Pending legacy verification challenges are discarded.

## WhatsApp recipient API

All routes are under `/v1`. Device routes require `Authorization: Device <installationId>.<secret>`:

- `GET /installations/me/whatsapp-recipients` lists all recipients for the authenticated installation.
- `POST /installations/me/whatsapp-recipients/verification/request` accepts `{ "contactName": "Night security", "phone": "+14155552671" }`. The challenge persists the contact name, mask, and fingerprint, never the complete number. It returns `challengeId`, `contactName`, `mask`, and expiry; only development with WhatsApp disabled also returns `developmentCode`.
- `POST /installations/me/whatsapp-recipients/verification/confirm` accepts `{ "challengeId", "phone", "code" }`. Repeating the transient phone binds confirmation to the original HMAC fingerprint. It returns `recipientId`, `contactName`, `mask`, `enabled`, and `verifiedAt`.
- `POST /installations/me/whatsapp-recipients/:recipientId/activate` and `/deactivate` toggle delivery eligibility; `DELETE` removes it.

Organization management routes require an OIDC bearer token and an `OWNER` or `ADMIN` membership:

- `GET /organizations/:organizationId/whatsapp-recipients` lists all organization recipients and includes `installationName` for grouping.
- Organization `activate`, `deactivate`, and `DELETE` routes use the same recipient suffixes. Recipients are alert contacts and are never linked to authenticated users.

## Alert dispatch integration contract

For `WEAPON_DETECTED` and `FACE_COVERED`, the local backend requests the current recipient list from its Electron parent immediately before each upload. Each installation may store up to 100 recipients, and the event POST may include up to 100 transient `{ recipientId, phone }` pairs. Cloud normalizes each E.164 value, recomputes its keyed fingerprint, and sends only when the ID, installation, fingerprint, verification, and enabled state all match.

Recipient phone values are never copied into `cloud_events.metadata` or any cloud entity. Deliveries retain only `recipientId` and a display mask and are idempotent per event, channel, and recipient. Invalid or stale pairs are skipped with sanitized audit data. A Meta failure returns an error so the edge outbox retries; recipients already marked `SENT` are not sent again.
