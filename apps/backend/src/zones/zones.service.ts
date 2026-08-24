import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from './entities/zone.entity';
import { CreateZoneDto } from '@security-ai/shared';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepo: Repository<Zone>,
  ) {}

  async findAll(): Promise<Zone[]> {
    return this.zoneRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCamera(cameraId: string): Promise<Zone[]> {
    return this.zoneRepo.find({
      where: { cameraId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Zone> {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  async create(dto: CreateZoneDto): Promise<Zone> {
    const zone = this.zoneRepo.create({
      cameraId: dto.camera_id,
      name: dto.name,
      polygon: JSON.stringify(dto.polygon),
      type: dto.type,
      enabled: dto.enabled ?? true,
    });
    return this.zoneRepo.save(zone);
  }

  async update(id: string, dto: Partial<CreateZoneDto>): Promise<Zone> {
    const zone = await this.findOne(id);
    if (dto.polygon) zone.polygon = JSON.stringify(dto.polygon);
    if (dto.name) zone.name = dto.name;
    if (dto.type) zone.type = dto.type;
    if (dto.enabled !== undefined) zone.enabled = dto.enabled;
    return this.zoneRepo.save(zone);
  }

  async remove(id: string): Promise<void> {
    const zone = await this.findOne(id);
    await this.zoneRepo.remove(zone);
  }
}
