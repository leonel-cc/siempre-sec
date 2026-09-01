import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUserParam, Public, Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.types';
import { MembershipRole } from '../entities/entities';
import { Throttle } from '@nestjs/throttler';
import { ApproveEnrollmentDto, ExchangeEnrollmentDto, RequestEnrollmentDto } from './enrollment.dto';
import { EnrollmentService } from './enrollment.service';

@Controller('enrollment')
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request')
  request(@Body() dto: RequestEnrollmentDto) {
    return this.enrollment.request(dto);
  }

  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @Post('approve')
  approve(@Body() dto: ApproveEnrollmentDto, @CurrentUserParam() user: CurrentUser) {
    return this.enrollment.approve(dto, user);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('exchange')
  exchange(@Body() dto: ExchangeEnrollmentDto) {
    return this.enrollment.exchange(dto);
  }
}
