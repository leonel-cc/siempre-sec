import { IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class RequestPhoneVerificationDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(40)
  phone: string;
}

export class ConfirmPhoneVerificationDto {
  @IsUUID()
  organizationId: string;

  @IsUUID()
  challengeId: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
