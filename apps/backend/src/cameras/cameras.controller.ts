import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
} from '@nestjs/common';
import { CamerasService } from './cameras.service';
import { AiClientService } from '../ai/ai-client.service';
import { ZonesService } from '../zones/zones.service';
import { RulesService } from '../rules/rules.service';
import { CreateCameraDto, UpdateCameraDto, ConnectionType } from '@security-ai/shared';

@Controller('cameras')
export class CamerasController {
  constructor(
    private readonly camerasService: CamerasService,
    private readonly aiClient: AiClientService,
    private readonly zonesService: ZonesService,
    private readonly rulesService: RulesService,
  ) {}

  @Get()
  findAll() {
    return this.camerasService.findAll();
  }

  @Get('usb-devices')
  async usbDevices() {
    const result = await this.aiClient.listUsbDevices();
    if (!result) return { devices: [], count: 0 };
    return result;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.camerasService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCameraDto) {
    return this.camerasService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.camerasService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.camerasService.remove(id);
  }

  @Post(':id/start')
  async startProcessing(@Param('id') id: string) {
    const camera = await this.camerasService.findOne(id);
    let result;
    if (camera.connectionType === ConnectionType.WEBCAM) {
      const deviceIndex = await this.aiClient.resolveUsbDeviceIndex(
        camera.name, camera.rtspUrl);
      result = await this.aiClient.addUsbSource(camera.id, deviceIndex);
    } else {
      result = await this.aiClient.addRtspSource(
        camera.id,
        camera.rtspUrl,
        camera.username,
        camera.encrypted_password,
      );
    }
    if (result) {
      await this.rulesService.syncRules();
      await this.camerasService.updateStatus(id, 'ONLINE');

      const zones = await this.zonesService.findByCamera(id);
      const zoneData = zones.map(z => ({
        id: z.id,
        name: z.name,
        type: z.type,
        polygon: JSON.parse(z.polygon),
        enabled: z.enabled,
      }));
      await this.aiClient.updateZones(id, zoneData);
    }
    return { status: result ? 'started' : 'failed_to_connect', camera_id: id };
  }

  @Post(':id/stop')
  async stopProcessing(@Param('id') id: string) {
    await this.aiClient.removeSource(id);
    await this.camerasService.updateStatus(id, 'DISABLED');
    return { status: 'stopped', camera_id: id };
  }

  @Post(':id/snapshot')
  @HttpCode(200)
  async getSnapshot(@Param('id') id: string) {
    return this.aiClient.getSnapshot(id);
  }

  @Post('start-file')
  async startFromFile(
    @Body() body: { camera_id: string; file_path: string; loop?: boolean },
  ) {
    const result = await this.aiClient.addFileSource(
      body.camera_id,
      body.file_path,
      body.loop ?? true,
    );
    return result;
  }

  @Post('discover')
  async discover() {
    return this.aiClient.discoverCameras();
  }
}
