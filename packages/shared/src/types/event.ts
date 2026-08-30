export enum EventType {
  MOTION = 'MOTION',
  PERSON_DETECTED = 'PERSON_DETECTED',
  UNKNOWN_PERSON = 'UNKNOWN_PERSON',
  KNOWN_PERSON = 'KNOWN_PERSON',
  RESTRICTED_ZONE = 'RESTRICTED_ZONE',
  VEHICLE_DETECTED = 'VEHICLE_DETECTED',
  SECURITY_ALERT = 'SECURITY_ALERT',
  WEAPON_DETECTED = 'WEAPON_DETECTED',
  FACE_COVERED = 'FACE_COVERED',
}

export enum EventStatus {
  NEW = 'NEW',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
}

export interface Event {
  id: string;
  camera_id: string;
  event_type: EventType;
  timestamp: string;
  confidence: number;
  person_id?: string;
  tracking_id?: number;
  zone_id?: string;
  snapshot_path?: string;
  video_path?: string;
  status: EventStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Detection {
  class: string;
  confidence: number;
  bbox: BoundingBox;
  tracking_id?: number;
  camera_id: string;
  timestamp: string;
  face_identity?: string;
  face_confidence?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateEventDto {
  camera_id: string;
  event_type: EventType;
  timestamp: string;
  confidence: number;
  person_id?: string;
  tracking_id?: number;
  zone_id?: string;
  snapshot_path?: string;
  video_path?: string;
  status?: EventStatus;
  metadata?: Record<string, unknown>;
}
