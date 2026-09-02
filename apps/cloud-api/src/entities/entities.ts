import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export enum MembershipRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum NotificationChannel {
  WHATSAPP = 'WHATSAPP',
}

@Entity('organizations')
@Index('idx_organizations_name', ['name'])
export class Organization extends BaseEntity {
  @Column({ length: 120 })
  name: string;
}

@Entity('users')
@Unique('uq_users_issuer_subject', ['issuer', 'subject'])
@Index('idx_users_email', ['email'])
export class User extends BaseEntity {
  @Column({ length: 500 })
  issuer: string;

  @Column({ length: 255 })
  subject: string;

  @Column({ nullable: true, length: 320 })
  email: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'display_name', nullable: true, length: 160 })
  displayName: string | null;
}

@Entity('memberships')
@Unique('uq_memberships_organization_email', ['organizationId', 'email'])
@Unique('uq_memberships_organization_user', ['organizationId', 'userId'])
@Index('idx_memberships_user', ['userId'])
@Index('idx_memberships_org_role', ['organizationId', 'role'])
export class Membership extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ length: 320 })
  email: string;

  @Column({ type: 'enum', enum: MembershipRole, enumName: 'membership_role_enum' })
  role: MembershipRole;

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId: string | null;
}

@Entity('installations')
@Index('idx_installations_org_heartbeat', ['organizationId', 'lastHeartbeatAt'])
export class Installation extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 40 })
  platform: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'secret_hash', length: 64 })
  secretHash: string;

  @Column({ name: 'last_heartbeat_at', type: 'timestamptz', nullable: true })
  lastHeartbeatAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}

@Entity('enrollment_challenges')
@Unique('uq_enrollment_device_code_hash', ['deviceCodeHash'])
@Unique('uq_enrollment_user_code', ['userCode'])
@Index('idx_enrollment_expiry', ['expiresAt'])
export class EnrollmentChallenge extends BaseEntity {
  @Column({ name: 'installation_name', length: 120 })
  installationName: string;

  @Column({ length: 40 })
  platform: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ name: 'device_code_hash', length: 64 })
  deviceCodeHash: string;

  @Column({ name: 'user_code', length: 12 })
  userCode: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}

@Entity('cloud_cameras')
@Unique('uq_cloud_cameras_installation_local', ['installationId', 'localCameraId'])
@Index('idx_cloud_cameras_org_installation', ['organizationId', 'installationId'])
export class CloudCamera extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'installation_id', type: 'uuid' })
  installationId: string;

  @ManyToOne(() => Installation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installation_id' })
  installation: Installation;

  @Column({ name: 'local_camera_id', length: 160 })
  localCameraId: string;

  @Column({ name: 'display_name', length: 160 })
  displayName: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  capabilities: Record<string, boolean>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'ingress_id', nullable: true, length: 160 })
  ingressId: string | null;

  @Column({ name: 'ingress_url', nullable: true, type: 'text' })
  ingressUrl: string | null;

  @Column({ name: 'ingress_stream_key', nullable: true, type: 'text' })
  ingressStreamKey: string | null;
}

@Entity('remote_commands')
@Index('idx_remote_commands_installation_status', ['installationId', 'status', 'expiresAt'])
export class RemoteCommand extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'installation_id', type: 'uuid' })
  installationId: string;

  @ManyToOne(() => Installation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installation_id' })
  installation: Installation;

  @Column({ length: 60 })
  type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ nullable: true, length: 500 })
  error: string | null;
}

@Entity('cloud_events')
@Unique('uq_cloud_events_installation_local', ['installationId', 'localEventId'])
@Index('idx_cloud_events_org_time', ['organizationId', 'occurredAt'])
@Index('idx_cloud_events_camera', ['cloudCameraId'])
export class CloudEvent extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'installation_id', type: 'uuid' })
  installationId: string;

  @ManyToOne(() => Installation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installation_id' })
  installation: Installation;

  @Column({ name: 'cloud_camera_id', type: 'uuid', nullable: true })
  cloudCameraId: string | null;

  @ManyToOne(() => CloudCamera, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cloud_camera_id' })
  cloudCamera: CloudCamera | null;

  @Column({ name: 'local_event_id', length: 160 })
  localEventId: string;

  @Column({ name: 'event_type', length: 80 })
  eventType: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}

@Entity('phone_recipients')
@Unique('uq_phone_recipients_installation_fingerprint', ['installationId', 'phoneFingerprint'])
@Index('idx_phone_recipients_org_installation', ['organizationId', 'installationId'])
export class PhoneRecipient extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'installation_id', type: 'uuid' })
  installationId: string;

  @ManyToOne(() => Installation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installation_id' })
  installation: Installation;

  @Column({ name: 'contact_name', length: 120 })
  contactName: string;

  @Column({ name: 'phone_mask', length: 24 })
  phoneMask: string;

  @Column({ name: 'phone_fingerprint', length: 64 })
  phoneFingerprint: string;

  @Column({ name: 'verified_at', type: 'timestamptz' })
  verifiedAt: Date;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'requires_reverification', default: false })
  requiresReverification: boolean;
}

@Entity('verification_challenges')
@Index('idx_verification_installation_expiry', ['installationId', 'expiresAt'])
@Check('ck_verification_attempts_nonnegative', 'attempts >= 0')
export class VerificationChallenge extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'installation_id', type: 'uuid' })
  installationId: string;

  @ManyToOne(() => Installation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installation_id' })
  installation: Installation;

  @Column({ name: 'contact_name', length: 120 })
  contactName: string;

  @Column({ name: 'phone_fingerprint', length: 64 })
  phoneFingerprint: string;

  @Column({ name: 'phone_mask', length: 24 })
  phoneMask: string;

  @Column({ name: 'code_hash', type: 'text' })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt: Date | null;
}

@Entity('notification_deliveries')
@Unique('uq_notification_event_channel_recipient', ['cloudEventId', 'channel', 'recipientId'])
@Index('idx_notification_org_created', ['organizationId', 'createdAt'])
export class NotificationDelivery extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'cloud_event_id', type: 'uuid' })
  cloudEventId: string;

  @ManyToOne(() => CloudEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cloud_event_id' })
  cloudEvent: CloudEvent;

  @Column({ type: 'enum', enum: NotificationChannel, enumName: 'notification_channel_enum' })
  channel: NotificationChannel;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  @Column({ name: 'phone_mask', length: 24, nullable: true })
  phoneMask: string | null;

  @Column({ length: 30 })
  status: string;

  @Column({ name: 'provider_message_id', nullable: true, length: 255 })
  providerMessageId: string | null;

  @Column({ name: 'error_code', nullable: true, length: 100 })
  errorCode: string | null;
}

@Entity('audit_entries')
@Index('idx_audit_org_created', ['organizationId', 'createdAt'])
@Index('idx_audit_user_created', ['actorUserId', 'createdAt'])
export class AuditEntry extends BaseEntity {
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_installation_id', type: 'uuid', nullable: true })
  actorInstallationId: string | null;

  @Column({ length: 100 })
  action: string;

  @Column({ name: 'target_type', nullable: true, length: 80 })
  targetType: string | null;

  @Column({ name: 'target_id', nullable: true, length: 160 })
  targetId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;
}

export const CLOUD_ENTITIES = [
  Organization,
  User,
  Membership,
  Installation,
  EnrollmentChallenge,
  CloudCamera,
  RemoteCommand,
  CloudEvent,
  PhoneRecipient,
  VerificationChallenge,
  NotificationDelivery,
  AuditEntry,
];
