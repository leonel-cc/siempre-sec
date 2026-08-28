import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiClientService } from '../ai/ai-client.service';
import { Rule } from './entities/rule.entity';

const FIXED_RULES = [
  {
    code: 'WEAPON_DETECTED',
    name: 'Arma o cuchillo detectado',
    description: 'Alerta por arma de fuego o cuchillo confirmado en varios cuadros.',
    priority: 1,
    actions: ['CREATE_ALERT', 'SEND_NOTIFICATION'],
    cooldownSeconds: 0,
  },
  {
    code: 'FACE_COVERED',
    name: 'Rostro cubierto detectado',
    description: 'Alerta por rostro cubierto confirmado en varios cuadros.',
    priority: 2,
    actions: ['CREATE_ALERT', 'SEND_NOTIFICATION'],
    cooldownSeconds: 0,
  },
];

@Injectable()
export class RulesService implements OnModuleInit {
  constructor(
    @InjectRepository(Rule)
    private readonly ruleRepo: Repository<Rule>,
    private readonly aiClient: AiClientService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async findAll(): Promise<Rule[]> {
    await this.ensureDefaults();
    const rules = await this.ruleRepo.find({ order: { priority: 'ASC' } });
    await this.syncRules(rules);
    return rules;
  }

  async findOne(id: string): Promise<Rule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Rule ${id} not found`);
    return rule;
  }

  async update(id: string, dto: { enabled?: boolean }): Promise<Rule> {
    const rule = await this.findOne(id);
    if (dto.enabled !== undefined) rule.enabled = dto.enabled;
    const saved = await this.ruleRepo.save(rule);
    await this.syncRules();
    return saved;
  }

  async syncRules(existing?: Rule[]) {
    const rules = existing || await this.ruleRepo.find({ order: { priority: 'ASC' } });
    return this.aiClient.setRules(rules.map(rule => ({
      id: rule.code.toLowerCase(),
      enabled: rule.enabled,
    })));
  }

  private async ensureDefaults() {
    const allowedCodes = new Set(FIXED_RULES.map(rule => rule.code));
    const obsoleteRules = (await this.ruleRepo.find())
      .filter(rule => !rule.code || !allowedCodes.has(rule.code));
    if (obsoleteRules.length) await this.ruleRepo.remove(obsoleteRules);

    for (const fixed of FIXED_RULES) {
      const existing = await this.ruleRepo.findOne({ where: { code: fixed.code } });
      if (existing) continue;
      await this.ruleRepo.save(this.ruleRepo.create({
        ...fixed,
        enabled: true,
        conditions: '[]',
        actions: JSON.stringify(fixed.actions),
      }));
    }
  }
}
