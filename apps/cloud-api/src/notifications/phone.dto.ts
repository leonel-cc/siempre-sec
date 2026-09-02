import { IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class RequestPhoneVerificationDto {
  @IsString()
  @MaxLength(120)
  @Matches(/\S/)
  contactName: string;

  @IsString()
  @MaxLength(40)
  phone: string;
}

export class ConfirmPhoneVerificationDto {
  @IsUUID()
  challengeId: string;

  @IsString()
  @MaxLength(40)
  phone: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
