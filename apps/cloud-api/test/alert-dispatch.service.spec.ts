import { AlertDispatchService } from '../src/notifications/alert-dispatch.service';
import { NotificationChannel } from '../src/entities/entities';
import { fingerprintPhone } from '../src/notifications/phone.crypto';

const secret = 'test-phone-fingerprint-secret-32-characters';
const phone = '+14155552671';
const event = {
  id: 'event-id',
  organizationId: 'organization-id',
  eventType: 'WEAPON_DETECTED',
};
const installation = { id: 'installation-id', organizationId: 'organization-id' };
const recipient = {
  id: 'recipient-id',
  installationId: installation.id,
  phoneFingerprint: fingerprintPhone(phone, secret),
  phoneMask: '+1******2671',
  verifiedAt: new Date(),
  enabled: true,
};

function createService(enabled: boolean) {
  const deliveries = {
    findOneBy: jest.fn(),
    create: jest.fn(value => value),
    save: jest.fn(value => Promise.resolve(value)),
    update: jest.fn(),
  };
  const storedRecipients = { findOneBy: jest.fn().mockResolvedValue(recipient) };
  const whatsapp = {
    enabled,
    sendAlert: jest.fn().mockResolvedValue({ messageId: 'message-id' }),
  };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(secret) };
  const service = new AlertDispatchService(
    config as any,
    deliveries as any,
    storedRecipients as any,
    whatsapp as any,
    audit as any,
  );
  return { service, deliveries, storedRecipients, whatsapp, audit };
}

describe('AlertDispatchService', () => {
  it('omits dispatch without creating delivery state when WhatsApp is disabled outside production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const context = createService(false);

    try {
      await context.service.dispatch(event as any, installation as any, [
        { recipientId: recipient.id, phone },
      ], 'Front door');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }

    expect(context.storedRecipients.findOneBy).not.toHaveBeenCalled();
    expect(context.deliveries.save).not.toHaveBeenCalled();
    expect(context.whatsapp.sendAlert).not.toHaveBeenCalled();
  });

  it('does not send an already completed event/channel/recipient delivery again', async () => {
    const context = createService(true);
    context.deliveries.findOneBy.mockResolvedValue({
      cloudEventId: event.id,
      channel: NotificationChannel.WHATSAPP,
      recipientId: recipient.id,
      status: 'SENT',
    });

    await context.service.dispatch(event as any, installation as any, [
      { recipientId: recipient.id, phone },
    ], 'Front door');

    expect(context.whatsapp.sendAlert).not.toHaveBeenCalled();
    expect(context.deliveries.save).not.toHaveBeenCalled();
  });
});
