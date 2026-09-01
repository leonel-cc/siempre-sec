import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudCamera, Installation, RemoteCommand } from '../entities/entities';
import { LiveKitMediaProvider } from './livekit-media.provider';
import { MEDIA_PROVIDER } from './media.provider';
import { ViewSessionsController } from './view-sessions.controller';
import { ViewSessionsService } from './view-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([CloudCamera, Installation, RemoteCommand])],
  controllers: [ViewSessionsController],
  providers: [
    ViewSessionsService,
    LiveKitMediaProvider,
    { provide: MEDIA_PROVIDER, useExisting: LiveKitMediaProvider },
  ],
  exports: [MEDIA_PROVIDER],
})
export class MediaModule {}
