import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialCloudSchema1788208000000 implements MigrationInterface {
  name = 'InitialCloudSchema1788208000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "membership_role_enum" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER')`);
    await queryRunner.query(`CREATE TYPE "notification_channel_enum" AS ENUM ('WHATSAPP')`);
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "name" varchar(120) NOT NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_organizations_name" ON "organizations" ("name")`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "issuer" varchar(500) NOT NULL,
        "subject" varchar(255) NOT NULL,
        "email" varchar(320),
        "email_verified" boolean NOT NULL DEFAULT false,
        "display_name" varchar(160),
        CONSTRAINT "uq_users_issuer_subject" UNIQUE ("issuer", "subject")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email")`);
    await queryRunner.query(`
      CREATE TABLE "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "email" varchar(320) NOT NULL,
        "role" membership_role_enum NOT NULL,
        "invited_by_user_id" uuid,
        CONSTRAINT "uq_memberships_organization_email" UNIQUE ("organization_id", "email"),
        CONSTRAINT "uq_memberships_organization_user" UNIQUE ("organization_id", "user_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_memberships_user" ON "memberships" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_memberships_org_role" ON "memberships" ("organization_id", "role")`);
    await queryRunner.query(`
      CREATE TABLE "installations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "platform" varchar(40) NOT NULL,
        "public_key" text NOT NULL,
        "secret_hash" varchar(64) NOT NULL,
        "last_heartbeat_at" timestamptz,
        "revoked_at" timestamptz
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_installations_org_heartbeat" ON "installations" ("organization_id", "last_heartbeat_at")`);
    await queryRunner.query(`
      CREATE TABLE "enrollment_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "installation_name" varchar(120) NOT NULL,
        "platform" varchar(40) NOT NULL,
        "public_key" text NOT NULL,
        "device_code_hash" varchar(64) NOT NULL,
        "user_code" varchar(12) NOT NULL,
        "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
        "approved_by_user_id" uuid,
        "expires_at" timestamptz NOT NULL,
        "approved_at" timestamptz,
        "consumed_at" timestamptz,
        CONSTRAINT "uq_enrollment_device_code_hash" UNIQUE ("device_code_hash"),
        CONSTRAINT "uq_enrollment_user_code" UNIQUE ("user_code")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_enrollment_expiry" ON "enrollment_challenges" ("expires_at")`);
    await queryRunner.query(`
      CREATE TABLE "cloud_cameras" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "installation_id" uuid NOT NULL REFERENCES "installations"("id") ON DELETE CASCADE,
        "local_camera_id" varchar(160) NOT NULL,
        "display_name" varchar(160) NOT NULL,
        "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "ingress_id" varchar(160),
        "ingress_url" text,
        "ingress_stream_key" text,
        CONSTRAINT "uq_cloud_cameras_installation_local" UNIQUE ("installation_id", "local_camera_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_cloud_cameras_org_installation" ON "cloud_cameras" ("organization_id", "installation_id")`);
    await queryRunner.query(`
      CREATE TABLE "remote_commands" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "installation_id" uuid NOT NULL REFERENCES "installations"("id") ON DELETE CASCADE,
        "type" varchar(60) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz NOT NULL,
        "acknowledged_at" timestamptz,
        "error" varchar(500)
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_remote_commands_installation_status" ON "remote_commands" ("installation_id", "status", "expires_at")`);
    await queryRunner.query(`
      CREATE TABLE "cloud_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "installation_id" uuid NOT NULL REFERENCES "installations"("id") ON DELETE CASCADE,
        "cloud_camera_id" uuid REFERENCES "cloud_cameras"("id") ON DELETE SET NULL,
        "local_event_id" varchar(160) NOT NULL,
        "event_type" varchar(80) NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT "uq_cloud_events_installation_local" UNIQUE ("installation_id", "local_event_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_cloud_events_org_time" ON "cloud_events" ("organization_id", "occurred_at")`);
    await queryRunner.query(`CREATE INDEX "idx_cloud_events_camera" ON "cloud_events" ("cloud_camera_id")`);
    await queryRunner.query(`
      CREATE TABLE "phone_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "phone_e164" varchar(16) NOT NULL,
        "verified_at" timestamptz,
        CONSTRAINT "uq_phone_recipients_organization" UNIQUE ("organization_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_phone_recipients_verified" ON "phone_recipients" ("verified_at")`);
    await queryRunner.query(`
      CREATE TABLE "verification_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "requested_by_user_id" uuid NOT NULL,
        "phone_e164" varchar(16) NOT NULL,
        "code_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts" smallint NOT NULL DEFAULT 0,
        "consumed_at" timestamptz,
        CONSTRAINT "ck_verification_attempts_nonnegative" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_verification_org_expiry" ON "verification_challenges" ("organization_id", "expires_at")`);
    await queryRunner.query(`
      CREATE TABLE "notification_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "cloud_event_id" uuid NOT NULL REFERENCES "cloud_events"("id") ON DELETE CASCADE,
        "channel" notification_channel_enum NOT NULL,
        "status" varchar(30) NOT NULL,
        "provider_message_id" varchar(255),
        "error_code" varchar(100),
        CONSTRAINT "uq_notification_event_channel" UNIQUE ("cloud_event_id", "channel")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_notification_org_created" ON "notification_deliveries" ("organization_id", "created_at")`);
    await queryRunner.query(`
      CREATE TABLE "audit_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "organization_id" uuid,
        "actor_user_id" uuid,
        "actor_installation_id" uuid,
        "action" varchar(100) NOT NULL,
        "target_type" varchar(80),
        "target_id" varchar(160),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_org_created" ON "audit_entries" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_user_created" ON "audit_entries" ("actor_user_id", "created_at")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_entries"`);
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(`DROP TABLE "verification_challenges"`);
    await queryRunner.query(`DROP TABLE "phone_recipients"`);
    await queryRunner.query(`DROP TABLE "cloud_events"`);
    await queryRunner.query(`DROP TABLE "remote_commands"`);
    await queryRunner.query(`DROP TABLE "cloud_cameras"`);
    await queryRunner.query(`DROP TABLE "enrollment_challenges"`);
    await queryRunner.query(`DROP TABLE "installations"`);
    await queryRunner.query(`DROP TABLE "memberships"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TYPE "notification_channel_enum"`);
    await queryRunner.query(`DROP TYPE "membership_role_enum"`);
  }
}
