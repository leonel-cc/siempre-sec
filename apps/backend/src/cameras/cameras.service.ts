import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Camera } from './entities/camera.entity';
import { CreateCameraDto, UpdateCameraDto, ConnectionType } from '@security-ai/shared';

@Injectable()
export class CamerasService {
  constructor(
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,
  ) {}

  async findAll(): Promise<Camera[]> {
    return this.cameraRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Camera> {
    const camera = await this.cameraRepo.findOne({ where: { id } });
    if (!camera) throw new NotFoundException(`Camera ${id} not found`);
    return camera;
  }

  async create(dto: CreateCameraDto): Promise<Camera> {
    const isWebcam = dto.connection_type === ConnectionType.WEBCAM;
    const camera = this.cameraRepo.create({
      name: dto.name,
      host: isWebcam ? 'local' : dto.host,
      port: isWebcam ? 0 : dto.port || 554,
      username: dto.username || '',
      encrypted_password: dto.password || '',
      rtspUrl: isWebcam
        ? dto.rtsp_url || 'device://0'
        : dto.rtsp_url || `rtsp://${dto.host}:${dto.port || 554}/stream`,
      onvifEnabled: dto.onvif_enabled || false,
      enabled: dto.enabled ?? true,
      connectionType: dto.connection_type || 'RTSP',
    });
    return this.cameraRepo.save(camera);
  }

  async update(id: string, dto: UpdateCameraDto): Promise<Camera> {
    const camera = await this.findOne(id);
    Object.assign(camera, dto);
    return this.cameraRepo.save(camera);
  }

  async remove(id: string): Promise<void> {
    const camera = await this.findOne(id);
    await this.cameraRepo.remove(camera);
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.cameraRepo.update(id, { status });
  }
}
