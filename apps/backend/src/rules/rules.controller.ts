import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  findAll() {
    return this.rulesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { enabled?: boolean }) {
    return this.rulesService.update(id, dto);
  }
}
