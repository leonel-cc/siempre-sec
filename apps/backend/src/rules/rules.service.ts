import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from './entities/rule.entity';
import { CreateRuleDto } from '@security-ai/shared';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule)
    private readonly ruleRepo: Repository<Rule>,
  ) {}

  async findAll(): Promise<Rule[]> {
    return this.ruleRepo.find({ order: { priority: 'ASC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Rule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Rule ${id} not found`);
    return rule;
  }

  async create(dto: CreateRuleDto): Promise<Rule> {
    const rule = this.ruleRepo.create({
      name: dto.name,
      description: dto.description || '',
      enabled: dto.enabled ?? true,
      priority: dto.priority || 0,
      conditions: JSON.stringify(dto.conditions),
      actions: JSON.stringify(dto.actions),
      schedule: dto.schedule ? JSON.stringify(dto.schedule) : undefined,
      cooldownSeconds: dto.cooldown_seconds || 60,
    });
    return this.ruleRepo.save(rule);
  }

  async update(id: string, dto: Partial<CreateRuleDto>): Promise<Rule> {
    const rule = await this.findOne(id);
    if (dto.name) rule.name = dto.name;
    if (dto.description !== undefined) rule.description = dto.description;
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    if (dto.priority !== undefined) rule.priority = dto.priority;
    if (dto.conditions) rule.conditions = JSON.stringify(dto.conditions);
    if (dto.actions) rule.actions = JSON.stringify(dto.actions);
    if (dto.schedule) rule.schedule = JSON.stringify(dto.schedule);
    if (dto.cooldown_seconds !== undefined) rule.cooldownSeconds = dto.cooldown_seconds;
    return this.ruleRepo.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    await this.ruleRepo.remove(rule);
  }
}
