import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Get(':section')
  getSection(@Param('section') section: string) {
    return this.settingsService.getSection(section);
  }

  @Put(':section')
  updateSection(
    @Param('section') section: string,
    @Body() body: Record<string, any>,
  ) {
    return this.settingsService.setBulk(section, body);
  }
}
