import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get('AI_SERVICE_HOST', 'localhost');
    const port = this.config.get('AI_SERVICE_PORT', '5000');
    this.baseUrl = `http://${host}:${port}`;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!response.ok) {
        this.logger.warn(`AI service request failed: ${path} -> ${response.status}`);
        return null;
      }
      return response.json() as Promise<T>;
    } catch (error) {
      this.logger.warn(`AI service unreachable: ${(error as Error).message}`);
      return null;
    }
  }

  async getHealth() {
    return this.request<{ status: string; models_loaded: boolean }>('/health');
  }

  async getStats() {
    return this.request<Record<string, unknown>>('/stats');
  }

  async addFileSource(sourceId: string, filePath: string, loop = true, targetFps = 25) {
    return this.request(`/sources/file`, {
      method: 'POST',
      body: JSON.stringify({
        source_id: sourceId,
        file_path: filePath,
        loop,
        target_fps: targetFps,
      }),
    });
  }

  async addRtspSource(sourceId: string, rtspUrl: string, username = '', password = '') {
    return this.request(`/sources/rtsp`, {
      method: 'POST',
      body: JSON.stringify({
        source_id: sourceId,
        rtsp_url: rtspUrl,
        username,
        password,
      }),
    });
  }

  async listUsbDevices() {
    return this.request<{ devices: Array<{ index: number; name: string }>; count: number }>(
      '/devices/usb',
    );
  }

  async addUsbSource(sourceId: string, deviceIndex: number, targetFps = 25) {
    return this.request(`/sources/usb`, {
      method: 'POST',
      body: JSON.stringify({
        source_id: sourceId,
        device_index: deviceIndex,
        target_fps: targetFps,
      }),
    });
  }

  async removeSource(sourceId: string) {
    return this.request(`/sources/${sourceId}`, { method: 'DELETE' });
  }

  async listSources() {
    return this.request<any[]>('/sources');
  }

  async getSourceInfo(sourceId: string) {
    return this.request<any>(`/sources/${sourceId}`);
  }

  async startSource(sourceId: string) {
    return this.request(`/sources/${sourceId}/start`, { method: 'POST' });
  }

  async stopSource(sourceId: string) {
    return this.request(`/sources/${sourceId}/stop`, { method: 'POST' });
  }

  async getSnapshot(sourceId: string) {
    return this.request<string>(`/sources/${sourceId}/snapshot`);
  }

  async detectFromImage(cameraId: string, imageBase64: string) {
    return this.request<any>('/detect', {
      method: 'POST',
      body: JSON.stringify({
        camera_id: cameraId,
        image_base64: imageBase64,
      }),
    });
  }

  async discoverCameras(timeout = 5) {
    return this.request<{ devices: any[]; count: number }>(
      `/discover?timeout=${timeout}`,
      { method: 'POST' },
    );
  }

  async checkMedia() {
    return this.request<{ ffmpeg: boolean; mediamtx: boolean }>('/media/check');
  }

  async updateZones(cameraId: string, zones: any[]) {
    return this.request('/zones', {
      method: 'POST',
      body: JSON.stringify({
        camera_id: cameraId,
        zones,
      }),
    });
  }
}
