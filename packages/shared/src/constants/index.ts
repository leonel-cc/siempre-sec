export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;
export const DEFAULT_INFERENCE_FPS = 5;
export const DEFAULT_FACE_THRESHOLD = 0.6;
export const DEFAULT_MOTION_SENSITIVITY = 0.5;
export const DEFAULT_BUFFER_DURATION = 30;
export const DEFAULT_PRE_EVENT_SECONDS = 15;
export const DEFAULT_POST_EVENT_SECONDS = 15;
export const DEFAULT_ALERT_COOLDOWN = 60;
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_MAX_STORAGE_GB = 50;
export const DEFAULT_RECONNECT_INTERVAL_MS = 5000;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

export const DETECTION_CLASSES = [
  'person',
  'car',
  'motorcycle',
  'bicycle',
  'dog',
  'cat',
] as const;

const env: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? process.env : {};

export const BACKEND_PORT = parseInt(env.BACKEND_PORT || '3000', 10);
export const AI_SERVICE_PORT = parseInt(env.AI_SERVICE_PORT || '5000', 10);
export const MEDIAMTX_PORT = parseInt(env.MEDIAMTX_PORT || '8554', 10);
