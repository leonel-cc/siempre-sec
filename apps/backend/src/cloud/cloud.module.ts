import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamerasModule } from '../cameras/cameras.module';
import { CloudSyncService } from './cloud-sync.service';
import { CloudOutbox } from './entities/cloud-outbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CloudOutbox]), CamerasModule],
  providers: [CloudSyncService],
  exports: [CloudSyncService],
})
export class CloudModule {}
