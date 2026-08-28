import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camera } from './entities/camera.entity';
import { CamerasController } from './cameras.controller';
import { CamerasService } from './cameras.service';
import { AiModule } from '../ai/ai.module';
import { ZonesModule } from '../zones/zones.module';
import { RulesModule } from '../rules/rules.module';
import { CameraStartupService } from './camera-startup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Camera]),
    AiModule,
    ZonesModule,
    RulesModule,
  ],
  controllers: [CamerasController],
  providers: [CamerasService, CameraStartupService],
  exports: [CamerasService],
})
export class CamerasModule {}
