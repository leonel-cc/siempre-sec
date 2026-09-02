import {
  fingerprintPhone,
  hashVerificationCode,
  maskE164,
  normalizeE164,
  verifyVerificationCode,
} from '../src/notifications/phone.crypto';

describe('phone security helpers', () => {
  it('normalizes a basic E.164 number', () => {
    expect(normalizeE164(' +1 (415) 555-2671 ')).toBe('+14155552671');
  });

  it('rejects numbers without a country code', () => {
    expect(() => normalizeE164('4155552671')).toThrow('E.164');
  });

  it('hashes and verifies a code without storing it', async () => {
    const encoded = await hashVerificationCode('042719');
    expect(encoded).not.toContain('042719');
    await expect(verifyVerificationCode('042719', encoded)).resolves.toBe(true);
    await expect(verifyVerificationCode('042718', encoded)).resolves.toBe(false);
  });

  it('creates a stable keyed fingerprint without exposing the phone', () => {
    const phone = '+14155552671';
    const first = fingerprintPhone(phone, 'a'.repeat(32));
    expect(first).toHaveLength(64);
    expect(first).not.toContain(phone);
    expect(first).toBe(fingerprintPhone(phone, 'a'.repeat(32)));
    expect(first).not.toBe(fingerprintPhone(phone, 'b'.repeat(32)));
  });

  it('masks all but routing context and the final four digits', () => {
    expect(maskE164('+14155552671')).toBe('+1******2671');
  });
});
