import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsIn,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class AcknowledgeCommandDto {
  @IsIn(['ACKNOWLEDGED', 'FAILED'])
  status: 'ACKNOWLEDGED' | 'FAILED';

  @IsOptional()
  @IsString()
  @Length(1, 500)
  error?: string;
}

export class CameraCapabilitiesDto {
  @IsOptional()
  @IsBoolean()
  liveView?: boolean;

  @IsOptional()
  @IsBoolean()
  audio?: boolean;

  @IsOptional()
  @IsBoolean()
  ptz?: boolean;

  @IsOptional()
  @IsBoolean()
  events?: boolean;
}

export class CameraMetadataDto {
  @IsString()
  @Length(1, 160)
  localCameraId: string;

  @IsString()
  @Length(1, 160)
  displayName: string;

  @ValidateNested()
  @Type(() => CameraCapabilitiesDto)
  capabilities: CameraCapabilitiesDto;

  @IsBoolean()
  enabled: boolean;
}

export class SyncCamerasDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CameraMetadataDto)
  cameras: CameraMetadataDto[];
}
