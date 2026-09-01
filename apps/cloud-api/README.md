# Cloud API

First control-plane slice for organizations, edge installation enrollment, camera metadata, cloud event indexing, remote LiveKit viewing, and WhatsApp alerts.

## Run

1. Create a PostgreSQL database and copy `.env.example` to `.env`.
2. Supply the OIDC issuer, audience, and JWKS URI.
3. From this directory, run `npm install` when dependency installation is desired.
4. Run `npm run start:dev`.

The API is served under `/v1`. Schema synchronization is disabled except when `NODE_ENV=test`; production deployments must manage schema migrations externally.

## Credentials and providers

- OIDC credentials/configuration are required for all user-authenticated routes. Bearer tokens are verified against the configured remote JWKS.
- Pending email invitations are linked only when the OIDC token supplies the matching email with `email_verified=true`.
- LiveKit URL, API key, and secret are required to create a remote view session. The API returns `503` if they are absent.
- Meta Cloud API credentials and approved authentication/alert template names are required when WhatsApp is enabled.
- With WhatsApp disabled, non-production verification requests return `developmentCode`. Production never returns a code and fails closed with `503`.
- Invitation persistence is implemented, but invitation email delivery is deliberately an adapter responsibility and is not included.

## Security boundaries and limitations

- Edge camera sync accepts metadata only. Camera passwords, credentials, and RTSP URLs are neither accepted nor stored.
- Installation secrets and enrollment device codes are returned once and persisted only as hashes.
- The MVP stores event metadata only. There is no cloud evidence upload, image storage, or video storage.
- Basic E.164 normalization is intentionally conservative and requires a leading country code.
- The initial schema relies on TypeORM synchronization only for tests. Add reviewed PostgreSQL migrations before deployment.
