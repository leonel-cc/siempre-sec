import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PhoneRecipientTransport } from '@security-ai/shared';
import { CamerasService } from '../cameras/cameras.service';
import { CloudOutbox } from './entities/cloud-outbox.entity';
import { CloudSyncService, validatePhoneRecipients } from './cloud-sync.service';

const recipient = (index: number) => ({
  recipientId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
  phone: '+34123456789',
});

describe('validatePhoneRecipients', () => {
  it('accepts up to 100 valid recipients', () => {
    const recipients = Array.from({ length: 100 }, (_, index) => recipient(index));

    expect(validatePhoneRecipients(recipients)).toEqual(recipients);
  });

  it('rejects more than 100 recipients instead of truncating them', () => {
    const recipients = Array.from({ length: 101 }, (_, index) => recipient(index));

    expect(() => validatePhoneRecipients(recipients)).toThrow('exceeds the 100 recipient limit');
  });

  it.each([
    [{ ...recipient(1), recipientId: 'not-a-uuid' }, 'invalid UUID'],
    [{ ...recipient(1), phone: '34123456789' }, 'invalid E.164'],
  ])('rejects an invalid recipient before transport', (invalidRecipient, message) => {
    expect(() => validatePhoneRecipients([invalidRecipient])).toThrow(message);
  });
});

describe('phone recipient IPC requirement', () => {
  const createService = () => new CloudSyncService(
    { get: () => '' } as unknown as ConfigService,
    {} as CamerasService,
    {} as Repository<CloudOutbox>,
  ) as unknown as {
    requestPhoneRecipients(): Promise<PhoneRecipientTransport[]>;
  };

  afterEach(() => {
    delete process.env.PHONE_RECIPIENTS_IPC_REQUIRED;
  });

  it('returns no recipients without IPC in standalone mode', async () => {
    await expect(createService().requestPhoneRecipients()).resolves.toEqual([]);
  });

  it('rejects without IPC when the channel is required', async () => {
    process.env.PHONE_RECIPIENTS_IPC_REQUIRED = '1';

    await expect(createService().requestPhoneRecipients()).rejects.toThrow('channel is unavailable');
  });
});
