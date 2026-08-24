export enum ZoneType {
  MONITORED = 'MONITORED',
  RESTRICTED = 'RESTRICTED',
  IGNORE = 'IGNORE',
}

export interface Zone {
  id: string;
  camera_id: string;
  name: string;
  polygon: Point[];
  type: ZoneType;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface CreateZoneDto {
  camera_id: string;
  name: string;
  polygon: Point[];
  type: ZoneType;
  enabled?: boolean;
}
