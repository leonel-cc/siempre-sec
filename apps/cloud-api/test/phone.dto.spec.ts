import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestPhoneVerificationDto } from '../src/notifications/phone.dto';

describe('RequestPhoneVerificationDto', () => {
  it('accepts a contact name with a transient phone', async () => {
    const dto = plainToInstance(RequestPhoneVerificationDto, {
      contactName: 'Night security',
      phone: '+14155552671',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([undefined, '', '   '])('rejects an absent or blank contact name: %p', async (contactName) => {
    const dto = plainToInstance(RequestPhoneVerificationDto, {
      contactName,
      phone: '+14155552671',
    });

    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'contactName')).toBe(true);
  });
});
