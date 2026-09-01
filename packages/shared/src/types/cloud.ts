export type OrganizationRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export type InstallationStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'REVOKED';

export interface CloudOrganization {
  id: string;
  name: string;
  role: OrganizationRole;
}

export interface CloudInstallation {
  id: string;
  organizationId: string;
  name: string;
  platform: string;
  status: InstallationStatus;
  lastHeartbeatAt: string | null;
}

export interface CloudCameraMetadata {
  localCameraId: string;
  displayName: string;
  capabilities: Record<string, boolean>;
  enabled: boolean;
}

export interface EnrollmentRequest {
  installationName: string;
  platform: string;
  publicKey: string;
}

export interface EnrollmentChallengeResponse {
  deviceCode: string;
  userCode: string;
  expiresAt: string;
}

export interface EnrollmentExchangeResponse {
  installationId: string;
  secret: string;
}

export interface RemoteViewSession {
  provider: 'livekit';
  url: string;
  roomName: string;
  token: string;
  expiresAt: string;
}

export interface PhoneVerificationRequestResult {
  challengeId: string;
  expiresAt: string;
  developmentCode?: string;
}

export interface CloudEventInput {
  localEventId: string;
  localCameraId?: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}
