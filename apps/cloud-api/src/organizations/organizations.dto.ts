import { IsEmail, IsEnum, IsString, Length, MaxLength } from 'class-validator';
import { MembershipRole } from '../entities/entities';

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 120)
  name: string;
}

export class InviteMemberDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsEnum(MembershipRole)
  role: MembershipRole;
}
