import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConnectionType } from '@security-ai/shared';
import { AiClientService } from '../ai/ai-client.service';
import { RulesService } from '../rules/rules.service';
import { ZonesService } from '../zones/zones.service';
import { CamerasService } from './cameras.service';

@Injectable()
export class CameraStartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CameraStartupService.name);

  constructor(
    private readonly camerasService: CamerasService,
    private readonly aiClient: AiClientService,
    private readonly rulesService: RulesService,
    private readonly zonesService: ZonesService,
  ) {}

  onApplicationBootstrap() {
    void this.restoreCameras();
  }

  private async restoreCameras() {
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      const health = await this.aiClient.getHealth();
      if (health?.status === 'ok' && health.models_loaded) break;
      if (attempt === 60) {
        this.logger.warn('AI service did not become ready; cameras were not restored');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const cameras = (await this.camerasService.findAll()).filter(
      (camera) => camera.enabled && camera.status !== 'DISABLED',
    );
    if (cameras.length === 0) return;

    await this.rulesService.syncRules();
    const activeSources = await this.aiClient.listSources() || [];
    const activeIds = new Set(activeSources.map((source) => source.source_id));

    for (const camera of cameras) {
      let result: unknown = activeIds.has(camera.id) ? true : null;
      if (!result && camera.connectionType === ConnectionType.WEBCAM) {
        const deviceIndex = await this.aiClient.resolveUsbDeviceIndex(
          camera.name, camera.rtspUrl);
        result = await this.aiClient.addUsbSource(camera.id, deviceIndex);
      } else if (!result) {
        result = await this.aiClient.addRtspSource(
          camera.id, camera.rtspUrl, camera.username, camera.encrypted_password);
      }

      if (!result) {
        await this.camerasService.updateStatus(camera.id, 'ERROR');
        this.logger.warn(`Failed to restore camera ${camera.name}`);
        continue;
      }

      const zones = await this.zonesService.findByCamera(camera.id);
      await this.aiClient.updateZones(camera.id, zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        type: zone.type,
        polygon: JSON.parse(zone.polygon),
        enabled: zone.enabled,
      })));
      await this.camerasService.updateStatus(camera.id, 'ONLINE');
      this.logger.log(`Restored camera ${camera.name}`);
    }
  }
}
