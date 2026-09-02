import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EventRecipientDto {
  @IsUUID()
  recipientId: string;

  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phone must be a valid E.164 number' })
  phone: string;
}

export class IngestEventDto {
  @IsString()
  @Length(1, 160)
  localEventId: string;

  @IsString()
  @Length(1, 80)
  eventType: string;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  localCameraId?: string;

  @IsObject()
  metadata: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EventRecipientDto)
  recipients?: EventRecipientDto[];
}

export class EventListQueryDto {
  @IsOptional()
  @IsUUID()
  cameraId?: string;
}
