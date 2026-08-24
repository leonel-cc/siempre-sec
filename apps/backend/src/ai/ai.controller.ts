import { Controller, Get, Post, Delete, Body, Param, Query, HttpException } from '@nestjs/common';
import { AiClientService } from './ai-client.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiClient: AiClientService) {}

  @Get('health')
  async health() {
    const result = await this.aiClient.getHealth();
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Get('stats')
  async stats() {
    const result = await this.aiClient.getStats();
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('detect')
  async detect(@Body() body: { camera_id: string; image_base64?: string }) {
    const result = await this.aiClient.detectFromImage(body.camera_id, body.image_base64 || '');
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Get('sources')
  async listSources() {
    const result = await this.aiClient.listSources();
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('sources/file')
  async addFileSource(@Body() body: { source_id: string; file_path: string; loop?: boolean; target_fps?: number }) {
    const result = await this.aiClient.addFileSource(body.source_id, body.file_path, body.loop, body.target_fps);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('sources/rtsp')
  async addRtspSource(@Body() body: { source_id: string; rtsp_url: string; username?: string; password?: string }) {
    const result = await this.aiClient.addRtspSource(body.source_id, body.rtsp_url, body.username, body.password);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Get('devices/usb')
  async listUsbDevices() {
    const result = await this.aiClient.listUsbDevices();
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('sources/usb')
  async addUsbSource(@Body() body: { source_id: string; device_index: number; target_fps?: number }) {
    const result = await this.aiClient.addUsbSource(body.source_id, body.device_index, body.target_fps);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('sources/:id/start')
  async startSource(@Param('id') id: string) {
    const result = await this.aiClient.startSource(id);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('sources/:id/stop')
  async stopSource(@Param('id') id: string) {
    const result = await this.aiClient.stopSource(id);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Delete('sources/:id')
  async removeSource(@Param('id') id: string) {
    const result = await this.aiClient.removeSource(id);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('discover')
  async discover(@Query('timeout') timeout?: number) {
    const result = await this.aiClient.discoverCameras(timeout);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }

  @Post('zones')
  async updateZones(@Body() body: { camera_id: string; zones: any[] }) {
    const result = await this.aiClient.updateZones(body.camera_id, body.zones);
    if (!result) throw new HttpException('AI service unavailable', 503);
    return result;
  }
}
