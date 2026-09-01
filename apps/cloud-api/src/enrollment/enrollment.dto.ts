import { IsIn, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class RequestEnrollmentDto {
  @IsString()
  @Length(2, 120)
  installationName: string;

  @IsString()
  @IsIn(['linux', 'windows', 'macos'])
  platform: string;

  @IsString()
  @MinLength(32)
  @MaxLength(8192)
  publicKey: string;
}

export class ApproveEnrollmentDto {
  @IsString()
  @Length(8, 12)
  userCode: string;

  @IsUUID()
  organizationId: string;
}

export class ExchangeEnrollmentDto {
  @IsString()
  @MinLength(40)
  @MaxLength(200)
  deviceCode: string;
}
