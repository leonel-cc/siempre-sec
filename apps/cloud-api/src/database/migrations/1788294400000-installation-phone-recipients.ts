import { MigrationInterface, QueryRunner } from 'typeorm';
import { fingerprintPhone, maskE164, normalizeE164 } from '../../notifications/phone.crypto';

interface LegacyRecipientRow {
  id: string;
  organization_id: string;
  phone_e164: string;
}

interface InstallationRow {
  id: string;
  organization_id: string;
}

export class InstallationPhoneRecipients1788294400000 implements MigrationInterface {
  name = 'InstallationPhoneRecipients1788294400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const legacyRecipients = await queryRunner.query(
      `SELECT "id", "organization_id", "phone_e164" FROM "phone_recipients" WHERE "verified_at" IS NOT NULL`,
    ) as LegacyRecipientRow[];
    const fingerprintSecret = process.env.PHONE_FINGERPRINT_SECRET;
    if (legacyRecipients.length > 0 && !fingerprintSecret) {
      throw new Error('PHONE_FINGERPRINT_SECRET is required to migrate verified phone recipients');
    }

    const oldestInstallations = await queryRunner.query(`
      SELECT DISTINCT ON ("organization_id") "id", "organization_id"
      FROM "installations"
      WHERE "revoked_at" IS NULL
      ORDER BY "organization_id", "created_at" ASC, "id" ASC
    `) as InstallationRow[];
    const installationByOrganization = new Map(
      oldestInstallations.map(installation => [installation.organization_id, installation.id]),
    );
    for (const recipient of legacyRecipients) {
      if (!installationByOrganization.has(recipient.organization_id)) {
        throw new Error(
          `Cannot migrate verified phone recipients: organization ${recipient.organization_id} has no non-revoked installation`,
        );
      }
    }

    // Pending legacy challenges cannot be safely rebound to an installation and are intentionally discarded.
    await queryRunner.query(`TRUNCATE TABLE "verification_challenges"`);

    await queryRunner.query(`DROP INDEX "idx_verification_org_expiry"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "requested_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "phone_e164"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "installation_id" uuid`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "contact_name" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "phone_fingerprint" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "phone_mask" varchar(24)`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ALTER COLUMN "installation_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ALTER COLUMN "contact_name" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ALTER COLUMN "phone_fingerprint" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ALTER COLUMN "phone_mask" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD CONSTRAINT "fk_verification_installation" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX "idx_verification_installation_expiry" ON "verification_challenges" ("installation_id", "expires_at")`);

    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP CONSTRAINT "uq_phone_recipients_organization"`);
    await queryRunner.query(`DROP INDEX "idx_phone_recipients_verified"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "installation_id" uuid`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "contact_name" varchar(120)`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "phone_mask" varchar(24)`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "phone_fingerprint" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "enabled" boolean`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "requires_reverification" boolean`);
    for (const recipient of legacyRecipients) {
      let phoneE164: string;
      try {
        phoneE164 = normalizeE164(recipient.phone_e164);
      } catch {
        throw new Error(`Cannot migrate verified phone recipient ${recipient.id}: invalid legacy phone format`);
      }
      await queryRunner.query(`
        UPDATE "phone_recipients"
        SET "installation_id" = $1, "contact_name" = $2, "phone_mask" = $3,
            "phone_fingerprint" = $4, "enabled" = false, "requires_reverification" = true
        WHERE "id" = $5
      `, [
        installationByOrganization.get(recipient.organization_id),
        'Contacto migrado',
        maskE164(phoneE164),
        fingerprintPhone(phoneE164, fingerprintSecret!),
        recipient.id,
      ]);
    }
    await queryRunner.query(`DELETE FROM "phone_recipients" WHERE "verified_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "phone_e164"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "installation_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "contact_name" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "phone_mask" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "phone_fingerprint" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "verified_at" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "enabled" SET DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "enabled" SET NOT NULL`);
    await queryRunner.query(`UPDATE "phone_recipients" SET "requires_reverification" = false WHERE "requires_reverification" IS NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "requires_reverification" SET DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "requires_reverification" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD CONSTRAINT "fk_phone_recipient_installation" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD CONSTRAINT "uq_phone_recipients_installation_fingerprint" UNIQUE ("installation_id", "phone_fingerprint")`);
    await queryRunner.query(`CREATE INDEX "idx_phone_recipients_org_installation" ON "phone_recipients" ("organization_id", "installation_id")`);

    await queryRunner.query(`ALTER TABLE "notification_deliveries" DROP CONSTRAINT "uq_notification_event_channel"`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD "recipient_id" uuid`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD "phone_mask" varchar(24)`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD CONSTRAINT "uq_notification_event_channel_recipient" UNIQUE ("cloud_event_id", "channel", "recipient_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE "notification_deliveries"`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" DROP CONSTRAINT "uq_notification_event_channel_recipient"`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" DROP COLUMN "phone_mask"`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" DROP COLUMN "recipient_id"`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD CONSTRAINT "uq_notification_event_channel" UNIQUE ("cloud_event_id", "channel")`);

    // Full phone numbers are deliberately not retained by the new schema, so rollback cannot restore these rows.
    await queryRunner.query(`TRUNCATE TABLE "verification_challenges", "phone_recipients"`);
    await queryRunner.query(`DROP INDEX "idx_phone_recipients_org_installation"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP CONSTRAINT "uq_phone_recipients_installation_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP CONSTRAINT "fk_phone_recipient_installation"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "requires_reverification"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "enabled"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "phone_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "phone_mask"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "contact_name"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" DROP COLUMN "installation_id"`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD "phone_e164" varchar(16) NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ALTER COLUMN "verified_at" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "phone_recipients" ADD CONSTRAINT "uq_phone_recipients_organization" UNIQUE ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "idx_phone_recipients_verified" ON "phone_recipients" ("verified_at")`);

    await queryRunner.query(`DROP INDEX "idx_verification_installation_expiry"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP CONSTRAINT "fk_verification_installation"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "phone_mask"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "phone_fingerprint"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "contact_name"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" DROP COLUMN "installation_id"`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "requested_by_user_id" uuid NOT NULL`);
    await queryRunner.query(`ALTER TABLE "verification_challenges" ADD "phone_e164" varchar(16) NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_verification_org_expiry" ON "verification_challenges" ("organization_id", "expires_at")`);
  }
}
