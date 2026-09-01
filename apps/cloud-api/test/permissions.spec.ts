import { hasAnyRole, hasMinimumRole } from '../src/auth/permissions';
import { MembershipRole } from '../src/entities/entities';

describe('organization role checks', () => {
  it('matches explicit route roles', () => {
    expect(hasAnyRole(MembershipRole.ADMIN, [MembershipRole.OWNER, MembershipRole.ADMIN])).toBe(true);
    expect(hasAnyRole(MembershipRole.VIEWER, [MembershipRole.OWNER, MembershipRole.ADMIN])).toBe(false);
  });

  it('enforces role hierarchy', () => {
    expect(hasMinimumRole(MembershipRole.OWNER, MembershipRole.ADMIN)).toBe(true);
    expect(hasMinimumRole(MembershipRole.OPERATOR, MembershipRole.ADMIN)).toBe(false);
  });
});
