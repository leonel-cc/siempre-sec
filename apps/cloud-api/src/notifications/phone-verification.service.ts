import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/auth.types';
import { Installation, PhoneRecipient, VerificationChallenge } from '../entities/entities';
import { ConfirmPhoneVerificationDto, RequestPhoneVerificationDto } from './phone.dto';
import {
  fingerprintPhone,
  hashVerificationCode,
  maskE164,
  normalizeE164,
  verifyVerificationCode,
} from './phone.crypto';
import { disabledProviderMode, ProductionProviderDisabledError } from './provider-policy';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp.provider';

const MAX_ATTEMPTS = 5;
const MAX_RECIPIENTS_PER_INSTALLATION = 100;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

export interface PhoneRecipientView {
  id: string;
  organizationId: string;
  installationId: string;
  contactName: string;
  phoneMask: string;
  verifiedAt: Date;
  enabled: boolean;
  requiresReverification: boolean;
  installationName?: string;
}

@Injectable()
export class PhoneVerificationService {
  private readonly fingerprintSecret: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(VerificationChallenge)
    private readonly challenges: Repository<VerificationChallenge>,
    @InjectRepository(PhoneRecipient)
    private readonly recipients: Repository<PhoneRecipient>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    private readonly audit: AuditService,
  ) {
    this.fingerprintSecret = this.config.get<string>('PHONE_FINGERPRINT_SECRET')
      ?? 'development-only-phone-fingerprint-secret';
  }

  listForInstallation(installation: Installation): Promise<PhoneRecipientView[]> {
    return this.listViews({ installationId: installation.id });
  }

  async request(installation: Installation, dto: RequestPhoneVerificationDto) {
    const phoneE164 = this.readPhone(dto.phone);
    this.assertProviderAvailable();
    const phoneFingerprint = fingerprintPhone(phoneE164, this.fingerprintSecret);
    const recipientCount = await this.recipients.countBy({ installationId: installation.id });
    if (recipientCount >= MAX_RECIPIENTS_PER_INSTALLATION) {
      const existing = await this.recipients.findOneBy({
        installationId: installation.id,
        phoneFingerprint,
      });
      if (!existing) {
        throw new ConflictException('Maximum phone recipients per installation exceeded');
      }
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await this.challenges.save(this.challenges.create({
      organizationId: installation.organizationId,
      installationId: installation.id,
      contactName: dto.contactName.trim(),
      phoneFingerprint,
      phoneMask: maskE164(phoneE164),
      codeHash: await hashVerificationCode(code),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      attempts: 0,
      consumedAt: null,
    }));

    let developmentCode: string | undefined;
    if (this.whatsapp.enabled) await this.whatsapp.sendAuthenticationCode(phoneE164, code);
    else developmentCode = code;

    await this.audit.record({
      organizationId: installation.organizationId,
      actorInstallationId: installation.id,
      action: 'phone.verification_requested',
      targetType: 'verificationChallenge',
      targetId: challenge.id,
      metadata: { contactName: challenge.contactName, phoneMask: challenge.phoneMask },
    });
    return {
      challengeId: challenge.id,
      contactName: challenge.contactName,
      mask: challenge.phoneMask,
      expiresAt: challenge.expiresAt,
      developmentCode,
    };
  }

  async confirm(installation: Installation, dto: ConfirmPhoneVerificationDto) {
    const fingerprint = fingerprintPhone(this.readPhone(dto.phone), this.fingerprintSecret);
    const result = await this.dataSource.transaction(async manager => {
      await manager.getRepository(Installation).findOneOrFail({
        where: { id: installation.id },
        lock: { mode: 'pessimistic_write' },
      });
      const challengeRepository = manager.getRepository(VerificationChallenge);
      const challenge = await challengeRepository.findOne({
        where: { id: dto.challengeId, installationId: installation.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!challenge || challenge.expiresAt <= new Date() || challenge.consumedAt) {
        throw new BadRequestException('Verification challenge is invalid or expired');
      }
      if (challenge.attempts >= MAX_ATTEMPTS) throw new ConflictException('Maximum verification attempts exceeded');

      const matches = fingerprint === challenge.phoneFingerprint
        && await verifyVerificationCode(dto.code, challenge.codeHash);
      challenge.attempts += 1;
      if (!matches) {
        await challengeRepository.save(challenge);
        return null;
      }

      const recipients = manager.getRepository(PhoneRecipient);
      let recipient = await recipients.findOneBy({
        installationId: installation.id,
        phoneFingerprint: challenge.phoneFingerprint,
      });
      if (!recipient && await recipients.countBy({ installationId: installation.id })
        >= MAX_RECIPIENTS_PER_INSTALLATION) {
        throw new ConflictException('Maximum phone recipients per installation exceeded');
      }
      challenge.consumedAt = new Date();
      await challengeRepository.save(challenge);
      recipient ??= recipients.create({
        organizationId: installation.organizationId,
        installationId: installation.id,
        phoneFingerprint: challenge.phoneFingerprint,
      });
      recipient.contactName = challenge.contactName;
      recipient.phoneMask = challenge.phoneMask;
      recipient.verifiedAt = new Date();
      recipient.enabled = true;
      recipient.requiresReverification = false;
      return recipients.save(recipient);
    });

    if (!result) throw new BadRequestException('Verification code or phone is incorrect');
    await this.audit.record({
      organizationId: installation.organizationId,
      actorInstallationId: installation.id,
      action: 'phone.verified',
      targetType: 'phoneRecipient',
      targetId: result.id,
    });
    return {
      recipientId: result.id,
      contactName: result.contactName,
      mask: result.phoneMask,
      enabled: result.enabled,
      verifiedAt: result.verifiedAt,
      requiresReverification: result.requiresReverification,
    };
  }

  async setEnabledByInstallation(installation: Installation, recipientId: string, enabled: boolean) {
    const recipient = await this.findInstallationRecipient(installation.id, recipientId);
    if (enabled && recipient.requiresReverification) {
      throw new ConflictException('Phone recipient must be verified again before activation');
    }
    recipient.enabled = enabled;
    await this.recipients.save(recipient);
    await this.auditRecipient(recipient, enabled ? 'phone.enabled' : 'phone.disabled', null, installation.id);
    return this.view(recipient);
  }

  async deleteByInstallation(installation: Installation, recipientId: string): Promise<void> {
    const recipient = await this.findInstallationRecipient(installation.id, recipientId);
    await this.recipients.delete(recipient.id);
    await this.auditRecipient(recipient, 'phone.deleted', null, installation.id);
  }

  async listForOrganization(organizationId: string): Promise<PhoneRecipientView[]> {
    const recipients = await this.recipients.find({
      where: { organizationId },
      relations: { installation: true },
      order: { createdAt: 'ASC' },
    });
    return recipients.map(recipient => this.view(recipient));
  }

  async setEnabledByOrganization(organizationId: string, recipientId: string, enabled: boolean, user: CurrentUser) {
    const recipient = await this.findOrganizationRecipient(organizationId, recipientId);
    if (enabled && recipient.requiresReverification) {
      throw new ConflictException('Phone recipient must be verified again from its installation');
    }
    recipient.enabled = enabled;
    await this.recipients.save(recipient);
    await this.auditRecipient(recipient, enabled ? 'phone.enabled' : 'phone.disabled', user.id, null);
    return this.view(recipient);
  }

  async deleteByOrganization(organizationId: string, recipientId: string, user: CurrentUser): Promise<void> {
    const recipient = await this.findOrganizationRecipient(organizationId, recipientId);
    await this.recipients.delete(recipient.id);
    await this.auditRecipient(recipient, 'phone.deleted', user.id, null);
  }

  private async findOrganizationRecipient(organizationId: string, recipientId: string) {
    const recipient = await this.recipients.findOne({
      where: { id: recipientId, organizationId },
      relations: { installation: true },
    });
    if (!recipient) throw new NotFoundException('Phone recipient not found');
    return recipient;
  }

  private async findInstallationRecipient(installationId: string, recipientId: string) {
    const recipient = await this.recipients.findOneBy({ id: recipientId, installationId });
    if (!recipient) throw new NotFoundException('Phone recipient not found');
    return recipient;
  }

  private async listViews(where: { installationId?: string; organizationId?: string }): Promise<PhoneRecipientView[]> {
    const recipients = await this.recipients.find({ where, order: { createdAt: 'ASC' }, select: {
      id: true, organizationId: true, installationId: true, contactName: true, phoneMask: true,
      verifiedAt: true, enabled: true, requiresReverification: true,
    } });
    return recipients.map(recipient => this.view(recipient));
  }

  private view(recipient: PhoneRecipient): PhoneRecipientView {
    const { id, organizationId, installationId, contactName, phoneMask, verifiedAt, enabled, requiresReverification } = recipient;
    return {
      id,
      organizationId,
      installationId,
      contactName,
      phoneMask,
      verifiedAt,
      enabled,
      requiresReverification,
      ...(recipient.installation ? { installationName: recipient.installation.name } : {}),
    };
  }

  private readPhone(input: string): string {
    try { return normalizeE164(input); }
    catch (error) { throw new BadRequestException((error as Error).message); }
  }

  private assertProviderAvailable(): void {
    if (this.whatsapp.enabled) return;
    try { disabledProviderMode(process.env.NODE_ENV); }
    catch (error) {
      if (error instanceof ProductionProviderDisabledError) {
        throw new ServiceUnavailableException('WhatsApp provider is required in production');
      }
      throw error;
    }
  }

  private auditRecipient(recipient: PhoneRecipient, action: string, actorUserId: string | null, actorInstallationId: string | null) {
    return this.audit.record({
      organizationId: recipient.organizationId,
      actorUserId,
      actorInstallationId,
      action,
      targetType: 'phoneRecipient',
      targetId: recipient.id,
    });
  }
}
