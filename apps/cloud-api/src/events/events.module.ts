import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudCamera, CloudEvent } from '../entities/entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([CloudEvent, CloudCamera]), NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
