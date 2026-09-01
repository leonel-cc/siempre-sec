import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEntry } from '../entities/entities';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
