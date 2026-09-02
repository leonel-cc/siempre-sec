import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

const DEFAULTS: Record<string, Record<string, any>> = {
  ai: {
    yolo_model: 'yolov8n.pt',
    confidence_threshold: 0.5,
    inference_fps: 10,
    face_threshold: 0.6,
    motion_sensitivity: 0.5,
    show_people_overlay: false,
  },
  alerts: {
    cooldown_seconds: 60,
    pre_event_seconds: 15,
    post_event_seconds: 15,
  },
  storage: {
    max_storage_gb: 50,
    retention_days: 30,
  },
  cameras: {
    reconnect_interval_ms: 5000,
    max_reconnect_attempts: 10,
  },
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async getAll(): Promise<Record<string, Record<string, any>>> {
    const settings = await this.settingRepo.find();
    const result: Record<string, Record<string, any>> = {};

    for (const [section, keys] of Object.entries(DEFAULTS)) {
      result[section] = {};
      for (const [key, defaultValue] of Object.entries(keys)) {
        const found = settings.find(s => s.section === section && s.key === key);
        result[section][key] = found ? this.parseValue(found.value, defaultValue) : defaultValue;
      }
    }

    return result;
  }

  async getSection(section: string): Promise<Record<string, any>> {
    const all = await this.getAll();
    return all[section] || {};
  }

  async set(section: string, key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const existing = await this.settingRepo.findOne({ where: { section, key } });

    if (existing) {
      existing.value = stringValue;
      await this.settingRepo.save(existing);
    } else {
      const setting = this.settingRepo.create({ section, key, value: stringValue });
      await this.settingRepo.save(setting);
    }
  }

  async setBulk(section: string, values: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      await this.set(section, key, value);
    }
  }

  private parseValue(value: string, defaultValue: any): any {
    if (typeof defaultValue === 'boolean') {
      return value === 'true';
    }
    if (typeof defaultValue === 'number') {
      const num = parseFloat(value);
      return isNaN(num) ? defaultValue : num;
    }
    return value;
  }
}
