import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/env';
import { DevicesModule } from './devices/devices.module';
import { CLOUD_ENTITIES } from './entities/entities';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { InitialCloudSchema1788208000000 } from './database/migrations/1788208000000-initial-cloud-schema';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: CLOUD_ENTITIES,
        migrations: [InitialCloudSchema1788208000000],
        migrationsRun: config.get<string>('NODE_ENV') !== 'test',
        synchronize: config.get<string>('NODE_ENV') === 'test',
        logging: false,
      }),
    }),
    AuditModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    EnrollmentModule,
    DevicesModule,
    NotificationsModule,
    EventsModule,
    MediaModule,
  ],
})
export class AppModule {}
