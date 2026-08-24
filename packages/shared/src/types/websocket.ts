export enum WsEvent {
  CAMERA_STATUS_CHANGED = 'camera.status_changed',
  DETECTION_CREATED = 'detection.created',
  TRACKING_UPDATED = 'tracking.updated',
  FACE_RECOGNIZED = 'face.recognized',
  SECURITY_ALERT = 'security.alert',
  EVENT_CREATED = 'event.created',
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
  SYSTEM_METRICS = 'system.metrics',
}

export interface WsMessage<T = unknown> {
  event: WsEvent;
  data: T;
  timestamp: string;
}
