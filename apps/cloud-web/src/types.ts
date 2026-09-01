export type MembershipRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface Organization {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  role: MembershipRole;
  email: string;
  organization: Organization;
}

export interface Camera {
  id: string;
  organizationId: string;
  installationId: string;
  localCameraId: string;
  displayName: string;
  capabilities: Record<string, boolean>;
  enabled: boolean;
  online?: boolean;
  status?: 'online' | 'offline' | string;
  lastSeenAt?: string | null;
}

export interface CloudEvent {
  id: string;
  organizationId: string;
  installationId: string;
  cloudCameraId: string | null;
  localEventId: string;
  eventType: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface ViewSession {
  provider: string;
  url: string;
  roomName: string;
  token: string;
  expiresAt: string;
}

export interface PhoneChallenge {
  challengeId: string;
  expiresAt: string;
  developmentCode?: string;
}
