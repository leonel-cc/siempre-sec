import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUserParam, Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/auth.types';
import { MembershipRole } from '../entities/entities';
import { ConfirmPhoneVerificationDto, RequestPhoneVerificationDto } from './phone.dto';
import { PhoneVerificationService } from './phone-verification.service';

@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@Controller('phone-verification')
export class PhoneController {
  constructor(private readonly verification: PhoneVerificationService) {}

  @Post('request')
  request(@Body() dto: RequestPhoneVerificationDto, @CurrentUserParam() user: CurrentUser) {
    return this.verification.request(dto, user);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmPhoneVerificationDto, @CurrentUserParam() user: CurrentUser) {
    return this.verification.confirm(dto, user);
  }
}
