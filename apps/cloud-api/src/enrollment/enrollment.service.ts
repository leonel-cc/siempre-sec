import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/auth.types';
import { AuditEntry, EnrollmentChallenge, Installation } from '../entities/entities';
import { ApproveEnrollmentDto, ExchangeEnrollmentDto, RequestEnrollmentDto } from './enrollment.dto';
import { hashEnrollmentSecret } from './enrollment.crypto';

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(EnrollmentChallenge)
    private readonly challenges: Repository<EnrollmentChallenge>,
    private readonly audit: AuditService,
  ) {}

  async request(dto: RequestEnrollmentDto) {
    const deviceCode = randomBytes(32).toString('base64url');
    const userCode = randomBytes(6).toString('base64url').toUpperCase().replace(/[-_]/g, 'A').slice(0, 8);
    const challenge = await this.challenges.save(
      this.challenges.create({
        installationName: dto.installationName.trim(),
        platform: dto.platform,
        publicKey: dto.publicKey,
        deviceCodeHash: hashEnrollmentSecret(deviceCode),
        userCode,
        expiresAt: new Date(Date.now() + CHALLENGE_LIFETIME_MS),
        organizationId: null,
        approvedByUserId: null,
        approvedAt: null,
        consumedAt: null,
      }),
    );
    return { deviceCode, userCode, expiresAt: challenge.expiresAt };
  }

  async approve(dto: ApproveEnrollmentDto, user: CurrentUser) {
    const challenge = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EnrollmentChallenge);
      const found = await repository.findOne({
        where: { userCode: dto.userCode.toUpperCase(), expiresAt: MoreThan(new Date()) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!found) {
        throw new NotFoundException('Enrollment challenge not found or expired');
      }
      if (found.approvedAt || found.consumedAt) {
        throw new ConflictException('Enrollment challenge is no longer pending');
      }
      found.organizationId = dto.organizationId;
      found.approvedByUserId = user.id;
      found.approvedAt = new Date();
      return repository.save(found);
    });
    await this.audit.record({
      organizationId: dto.organizationId,
      actorUserId: user.id,
      action: 'enrollment.approved',
      targetType: 'enrollmentChallenge',
      targetId: challenge.id,
    });
    return { approved: true };
  }

  async exchange(dto: ExchangeEnrollmentDto) {
    const deviceCodeHash = hashEnrollmentSecret(dto.deviceCode);
    const result = await this.dataSource.transaction(async (manager) => {
      const challengeRepository = manager.getRepository(EnrollmentChallenge);
      const challenge = await challengeRepository.findOne({
        where: { deviceCodeHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!challenge || challenge.expiresAt <= new Date()) {
        throw new BadRequestException('Enrollment challenge not found or expired');
      }
      if (!challenge.approvedAt || !challenge.organizationId) {
        throw new ConflictException('Enrollment has not been approved');
      }
      if (challenge.consumedAt) {
        throw new ConflictException('Enrollment code has already been consumed');
      }

      const secret = randomBytes(32).toString('base64url');
      const installation = await manager.save(
        Installation,
        manager.create(Installation, {
          organizationId: challenge.organizationId,
          name: challenge.installationName,
          platform: challenge.platform,
          publicKey: challenge.publicKey,
          secretHash: hashEnrollmentSecret(secret),
          lastHeartbeatAt: null,
        }),
      );
      challenge.consumedAt = new Date();
      await challengeRepository.save(challenge);
      await manager.save(
        AuditEntry,
        manager.create(AuditEntry, {
          organizationId: installation.organizationId,
          actorUserId: challenge.approvedByUserId,
          actorInstallationId: null,
          action: 'enrollment.exchanged',
          targetType: 'installation',
          targetId: installation.id,
          metadata: {},
        }),
      );
      return { installation, secret, challenge };
    });
    return { installationId: result.installation.id, secret: result.secret };
  }
}
