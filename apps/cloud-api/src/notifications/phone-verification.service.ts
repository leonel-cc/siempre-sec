import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/auth.types';
import { PhoneRecipient, VerificationChallenge } from '../entities/entities';
import { ConfirmPhoneVerificationDto, RequestPhoneVerificationDto } from './phone.dto';
import { hashVerificationCode, normalizeE164, verifyVerificationCode } from './phone.crypto';
import { disabledProviderMode, ProductionProviderDisabledError } from './provider-policy';
import { WHATSAPP_PROVIDER, WhatsAppProvider } from './whatsapp.provider';

const MAX_ATTEMPTS = 5;

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VerificationChallenge)
    private readonly challenges: Repository<VerificationChallenge>,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsAppProvider,
    private readonly audit: AuditService,
  ) {}

  async request(dto: RequestPhoneVerificationDto, user: CurrentUser) {
    let phoneE164: string;
    try {
      phoneE164 = normalizeE164(dto.phone);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (!this.whatsapp.enabled) {
      try {
        disabledProviderMode(process.env.NODE_ENV);
      } catch (error) {
        if (error instanceof ProductionProviderDisabledError) {
          throw new ServiceUnavailableException('WhatsApp provider is required in production');
        }
        throw error;
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await this.challenges.save(
      this.challenges.create({
        organizationId: dto.organizationId,
        requestedByUserId: user.id,
        phoneE164,
        codeHash: await hashVerificationCode(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
      }),
    );

    let developmentCode: string | undefined;
    if (this.whatsapp.enabled) {
      await this.whatsapp.sendAuthenticationCode(phoneE164, code);
    } else {
      developmentCode = code;
    }
    await this.audit.record({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'phone.verification_requested',
      targetType: 'verificationChallenge',
      targetId: challenge.id,
    });
    return { challengeId: challenge.id, expiresAt: challenge.expiresAt, developmentCode };
  }

  async confirm(dto: ConfirmPhoneVerificationDto, user: CurrentUser) {
    const result = await this.dataSource.transaction(async (manager) => {
      const challengeRepository = manager.getRepository(VerificationChallenge);
      const challenge = await challengeRepository.findOne({
        where: { id: dto.challengeId, organizationId: dto.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!challenge || challenge.expiresAt <= new Date() || challenge.consumedAt) {
        throw new BadRequestException('Verification challenge is invalid or expired');
      }
      if (challenge.attempts >= MAX_ATTEMPTS) {
        throw new ConflictException('Maximum verification attempts exceeded');
      }
      const matches = await verifyVerificationCode(dto.code, challenge.codeHash);
      challenge.attempts += 1;
      if (!matches) {
        await challengeRepository.save(challenge);
        return { recipient: null, matches: false };
      }

      challenge.consumedAt = new Date();
      await challengeRepository.save(challenge);
      const recipients = manager.getRepository(PhoneRecipient);
      let verified = await recipients.findOneBy({ organizationId: dto.organizationId });
      verified ??= recipients.create({ organizationId: dto.organizationId });
      verified.phoneE164 = challenge.phoneE164;
      verified.verifiedAt = new Date();
      return { recipient: await recipients.save(verified), matches: true };
    });

    if (!result.matches || !result.recipient) {
      throw new BadRequestException('Verification code is incorrect');
    }
    const recipient = result.recipient;

    await this.audit.record({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'phone.verified',
      targetType: 'phoneRecipient',
      targetId: recipient.id,
    });
    return { verified: true, recipientId: recipient.id };
  }
}
