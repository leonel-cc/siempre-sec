import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUserParam, Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.types';
import { MembershipRole } from '../entities/entities';
import { CreateOrganizationDto, InviteMemberDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(@CurrentUserParam() user: CurrentUser) {
    return this.organizations.listForUser(user.id);
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUserParam() user: CurrentUser) {
    return this.organizations.create(dto, user);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Get(':organizationId/members')
  members(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.organizations.listMembers(organizationId);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Post(':organizationId/invitations')
  invite(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUserParam() user: CurrentUser,
  ) {
    return this.organizations.invite(organizationId, dto, user);
  }
}
