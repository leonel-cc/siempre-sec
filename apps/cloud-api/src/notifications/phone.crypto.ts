import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'crypto';

export function normalizeE164(input: string): string {
  const normalized = input.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Phone number must include a valid E.164 country code');
  }
  return normalized;
}

export function maskE164(phoneE164: string): string {
  const visibleDigits = phoneE164.slice(-4);
  return `${phoneE164.slice(0, 2)}${'*'.repeat(Math.max(4, phoneE164.length - 6))}${visibleDigits}`;
}

export function fingerprintPhone(phoneE164: string, secret: string): string {
  if (!secret) throw new Error('PHONE_FINGERPRINT_SECRET is required');
  return createHmac('sha256', secret).update(phoneE164, 'utf8').digest('hex');
}

function derive(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, 64, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashVerificationCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(code, salt);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyVerificationCode(code: string, encoded: string): Promise<boolean> {
  const [algorithm, saltValue, expectedValue] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !expectedValue) {
    return false;
  }
  const expected = Buffer.from(expectedValue, 'base64url');
  const actual = await derive(code, Buffer.from(saltValue, 'base64url'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
