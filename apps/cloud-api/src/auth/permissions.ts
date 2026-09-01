import { MembershipRole } from '../entities/entities';

const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.VIEWER]: 0,
  [MembershipRole.OPERATOR]: 1,
  [MembershipRole.ADMIN]: 2,
  [MembershipRole.OWNER]: 3,
};

export function hasAnyRole(actual: MembershipRole, allowed: readonly MembershipRole[]): boolean {
  return allowed.includes(actual);
}

export function hasMinimumRole(actual: MembershipRole, required: MembershipRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}
