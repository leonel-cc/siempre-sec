import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudCamera, Installation, RemoteCommand } from '../entities/entities';
import { MediaModule } from '../media/media.module';
import { DevicesController, InstallationAdminController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Installation, CloudCamera, RemoteCommand]),
    MediaModule,
  ],
  controllers: [DevicesController, InstallationAdminController],
  providers: [DevicesService],
})
export class DevicesModule {}
