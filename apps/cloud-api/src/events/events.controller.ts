import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentInstallation, DeviceAuth, Public, Roles } from '../auth/auth.decorators';
import { CloudEvent, Installation, MembershipRole } from '../entities/entities';
import { EventListQueryDto, IngestEventDto } from './events.dto';
import { EventsService } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @DeviceAuth()
  @Post('installations/me/events')
  ingest(
    @CurrentInstallation() installation: Installation,
    @Body() dto: IngestEventDto,
  ): Promise<CloudEvent> {
    return this.events.ingest(installation, dto);
  }

  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.OPERATOR,
    MembershipRole.VIEWER,
  )
  @Get('organizations/:organizationId/events')
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: EventListQueryDto,
  ) {
    return this.events.list(organizationId, query);
  }
}
