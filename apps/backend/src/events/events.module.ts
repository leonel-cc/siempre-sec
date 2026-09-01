import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CamerasModule } from '../cameras/cameras.module';
import { CloudModule } from '../cloud/cloud.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    WebsocketModule,
    NotificationsModule,
    CamerasModule,
    CloudModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
