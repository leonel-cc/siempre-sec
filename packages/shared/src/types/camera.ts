export enum CameraStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

export enum ConnectionType {
  RTSP = 'RTSP',
  ONVIF = 'ONVIF',
  FILE = 'FILE',
  WEBCAM = 'WEBCAM',
}

export interface Camera {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  rtsp_url: string;
  onvif_enabled: boolean;
  enabled: boolean;
  status: CameraStatus;
  connection_type: ConnectionType;
  stream_path?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCameraDto {
  name: string;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  rtsp_url?: string;
  onvif_enabled?: boolean;
  enabled?: boolean;
  connection_type?: ConnectionType;
}

export interface UpdateCameraDto extends Partial<CreateCameraDto> {}

export interface DiscoveredCamera {
  host: string;
  port: number;
  manufacturer?: string;
  model?: string;
  onvif_enabled: boolean;
  username?: string;
  rtsp_url?: string;
}
