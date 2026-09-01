import { BadRequestException } from '@nestjs/common';

const FORBIDDEN_KEY = /(password|credential|rtsp|stream_?url|camera_?url)/i;

export function assertNoCameraSecrets(value: unknown): void {
  if (typeof value === 'string' && /rtsp:\/\//i.test(value)) {
    throw new BadRequestException('Camera credentials and RTSP URLs are not accepted');
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoCameraSecrets);
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) {
      throw new BadRequestException('Camera credentials and RTSP URLs are not accepted');
    }
    assertNoCameraSecrets(nestedValue);
  }
}
