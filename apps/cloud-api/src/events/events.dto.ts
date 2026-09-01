import { IsDateString, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

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
}

export class EventListQueryDto {
  @IsOptional()
  @IsUUID()
  cameraId?: string;
}
