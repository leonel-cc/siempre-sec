import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEntry } from '../entities/entities';

export interface AuditInput {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorInstallationId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditEntry) private readonly entries: Repository<AuditEntry>) {}

  async record(input: AuditInput): Promise<void> {
    await this.entries.save(
      this.entries.create({
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorInstallationId: input.actorInstallationId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }
}
