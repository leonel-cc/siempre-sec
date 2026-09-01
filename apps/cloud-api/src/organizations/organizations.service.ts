import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEntry, Membership, MembershipRole, Organization, User } from '../entities/entities';
import { CurrentUser } from '../auth/auth.types';
import { CreateOrganizationDto, InviteMemberDto } from './organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: string): Promise<Membership[]> {
    return this.memberships.find({
      where: { userId },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
  }

  async create(dto: CreateOrganizationDto, user: CurrentUser): Promise<Organization> {
    const organization = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(Organization, manager.create(Organization, { name: dto.name.trim() }));
      await manager.save(
        Membership,
        manager.create(Membership, {
          organizationId: created.id,
          userId: user.id,
          email: user.email ?? `${user.subject}@unavailable.invalid`,
          role: MembershipRole.OWNER,
          invitedByUserId: user.id,
        }),
      );
      await manager.save(
        AuditEntry,
        manager.create(AuditEntry, {
          organizationId: created.id,
          actorUserId: user.id,
          actorInstallationId: null,
          action: 'organization.created',
          targetType: 'organization',
          targetId: created.id,
          metadata: {},
        }),
      );
      return created;
    });
    return organization;
  }

  listMembers(organizationId: string): Promise<Membership[]> {
    return this.memberships.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async invite(
    organizationId: string,
    dto: InviteMemberDto,
    actor: CurrentUser,
  ): Promise<{ membership: Membership; delivery: string }> {
    const email = dto.email.trim().toLowerCase();
    const membership = await this.dataSource.transaction(async manager => {
      await manager.findOneOrFail(Organization, {
        where: { id: organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      const actorMembership = await manager.findOneByOrFail(Membership, {
        organizationId,
        userId: actor.id,
      });
      if (dto.role === MembershipRole.OWNER && actorMembership.role !== MembershipRole.OWNER) {
        throw new ForbiddenException('Only an owner can grant owner role');
      }

      const linkedUser = await manager.findOneBy(User, { email, emailVerified: true });
      let target = await manager.findOne(Membership, {
        where: linkedUser
          ? [{ organizationId, email }, { organizationId, userId: linkedUser.id }]
          : { organizationId, email },
      });
      target ??= manager.create(Membership, { organizationId, email });
      if (target.role === MembershipRole.OWNER && actorMembership.role !== MembershipRole.OWNER) {
        throw new ForbiddenException('Only an owner can change an owner membership');
      }
      if (target.role === MembershipRole.OWNER && dto.role !== MembershipRole.OWNER) {
        const ownerCount = await manager.countBy(Membership, {
          organizationId,
          role: MembershipRole.OWNER,
        });
        if (ownerCount <= 1) {
          throw new ForbiddenException('An organization must retain at least one owner');
        }
      }
      target.email = email;
      target.userId = linkedUser?.id ?? target.userId ?? null;
      target.role = dto.role;
      target.invitedByUserId = actor.id;
      return manager.save(Membership, target);
    });

    await this.audit.record({
      organizationId,
      actorUserId: actor.id,
      action: 'organization.member_invited',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { role: dto.role },
    });

    return {
      membership,
      delivery: 'Invitation email delivery is the responsibility of an external adapter.',
    };
  }
}
