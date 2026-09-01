import { hashEnrollmentSecret, verifyEnrollmentSecret } from '../src/enrollment/enrollment.crypto';

describe('enrollment secret helpers', () => {
  it('creates a deterministic one-way hash and compares safely', () => {
    const hash = hashEnrollmentSecret('a-high-entropy-secret');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('a-high-entropy-secret');
    expect(verifyEnrollmentSecret('a-high-entropy-secret', hash)).toBe(true);
    expect(verifyEnrollmentSecret('another-secret', hash)).toBe(false);
  });
});
