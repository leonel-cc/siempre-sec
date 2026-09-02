import { ROLES_KEY } from '../src/auth/auth.decorators';
import { MembershipRole } from '../src/entities/entities';
import { OrganizationPhoneRecipientsController } from '../src/notifications/phone.controller';

describe('OrganizationPhoneRecipientsController', () => {
  it('requires owner or admin for every organization management endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OrganizationPhoneRecipientsController)).toEqual([
      MembershipRole.OWNER,
      MembershipRole.ADMIN,
    ]);
  });
});
