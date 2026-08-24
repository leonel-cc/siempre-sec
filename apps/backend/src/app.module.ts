import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { CamerasModule } from './cameras/cameras.module';
import { EventsModule } from './events/events.module';
import { PeopleModule } from './people/people.module';
import { ZonesModule } from './zones/zones.module';
import { RulesModule } from './rules/rules.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemModule } from './system/system.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SettingsModule } from './settings/settings.module';
import { EvidenceModule } from './evidence/evidence.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqljs',
      location: process.env.DATABASE_PATH || './data/security-ai.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      autoSave: true,
    }),
    AiModule,
    CamerasModule,
    EventsModule,
    PeopleModule,
    ZonesModule,
    RulesModule,
    NotificationsModule,
    SystemModule,
    WebsocketModule,
    SettingsModule,
    EvidenceModule,
  ],
})
export class AppModule {}
