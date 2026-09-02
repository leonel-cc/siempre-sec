import { ConflictException } from '@nestjs/common';
import { PhoneVerificationService } from '../src/notifications/phone-verification.service';

const secret = 'test-phone-fingerprint-secret-32-characters';
const installation = { id: 'installation-id', organizationId: 'organization-id' };
const dto = { contactName: 'Night security', phone: '+14155552671' };

function createService(existingRecipient: object | null) {
  const challenges = {
    create: jest.fn(value => value),
    save: jest.fn(value => Promise.resolve({ id: 'challenge-id', ...value })),
  };
  const recipients = {
    countBy: jest.fn().mockResolvedValue(100),
    findOneBy: jest.fn().mockResolvedValue(existingRecipient),
    save: jest.fn(value => Promise.resolve(value)),
  };
  const whatsapp = {
    enabled: true,
    sendAuthenticationCode: jest.fn().mockResolvedValue({ messageId: 'message-id' }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new PhoneVerificationService(
    {} as any,
    { get: jest.fn().mockReturnValue(secret) } as any,
    challenges as any,
    recipients as any,
    whatsapp as any,
    audit as any,
  );
  return { service, challenges, recipients, whatsapp };
}

describe('PhoneVerificationService recipient limit', () => {
  it('rejects a new OTP enrollment when the installation already has 100 recipients', async () => {
    const context = createService(null);

    await expect(context.service.request(installation as any, dto))
      .rejects.toBeInstanceOf(ConflictException);
    expect(context.challenges.save).not.toHaveBeenCalled();
    expect(context.whatsapp.sendAuthenticationCode).not.toHaveBeenCalled();
  });

  it('allows an existing recipient to be reverified at the limit', async () => {
    const context = createService({ id: 'recipient-id' });

    await expect(context.service.request(installation as any, dto))
      .resolves.toMatchObject({ challengeId: 'challenge-id' });
    expect(context.challenges.save).toHaveBeenCalledTimes(1);
    expect(context.whatsapp.sendAuthenticationCode).toHaveBeenCalledTimes(1);
  });

  it('does not activate a migrated recipient until it is verified locally again', async () => {
    const context = createService({
      id: 'recipient-id',
      requiresReverification: true,
      enabled: false,
    });

    await expect(context.service.setEnabledByInstallation(
      installation as any,
      'recipient-id',
      true,
    )).rejects.toBeInstanceOf(ConflictException);
    expect(context.recipients.save).not.toHaveBeenCalled();
  });
});
