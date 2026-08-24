export interface SystemHealth {
  backend: ServiceStatus;
  ai_service: ServiceStatus;
  mediamtx: ServiceStatus;
  database: ServiceStatus;
  cameras: CameraHealth[];
  whatsapp: WhatsAppStatus;
  system: SystemMetrics;
}

export interface ServiceStatus {
  status: 'ONLINE' | 'OFFLINE';
  uptime_seconds?: number;
  last_check: string;
}

export interface CameraHealth {
  camera_id: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  fps?: number;
  latency_ms?: number;
}

export interface WhatsAppStatus {
  configured: boolean;
  enabled: boolean;
  last_test?: string;
}

export interface SystemMetrics {
  cpu_usage_percent: number;
  memory_usage_percent: number;
  disk_usage_percent: number;
  gpu_available: boolean;
  gpu_usage_percent?: number;
  gpu_memory_percent?: number;
}
