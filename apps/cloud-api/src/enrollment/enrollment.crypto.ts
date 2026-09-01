import { createHash, timingSafeEqual } from 'crypto';

export function hashEnrollmentSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function verifyEnrollmentSecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashEnrollmentSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
