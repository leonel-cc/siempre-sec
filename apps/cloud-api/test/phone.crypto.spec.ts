import { hashVerificationCode, normalizeE164, verifyVerificationCode } from '../src/notifications/phone.crypto';

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
});
