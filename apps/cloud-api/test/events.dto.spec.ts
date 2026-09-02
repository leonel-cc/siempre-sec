import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestEventDto } from '../src/events/events.dto';

const validEvent = {
  localEventId: 'event-1',
  eventType: 'WEAPON_DETECTED',
  occurredAt: '2026-09-02T12:00:00.000Z',
  metadata: {},
};

describe('IngestEventDto recipients', () => {
  it('accepts up to 100 UUID/E.164 recipient pairs', async () => {
    const recipients = Array.from({ length: 100 }, (_, index) => ({
      recipientId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      phone: `+1415555${String(1000 + index)}`,
    }));
    const errors = await validate(plainToInstance(IngestEventDto, { ...validEvent, recipients }));
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 100 recipients', async () => {
    const recipient = { recipientId: '00000000-0000-4000-8000-000000000001', phone: '+14155552671' };
    const errors = await validate(plainToInstance(IngestEventDto, {
      ...validEvent,
      recipients: Array.from({ length: 101 }, () => recipient),
    }));
    expect(errors.some((error) => error.property === 'recipients')).toBe(true);
  });

  it('rejects non-UUID identifiers and non-E.164 phone values', async () => {
    const errors = await validate(plainToInstance(IngestEventDto, {
      ...validEvent,
      recipients: [{ recipientId: 'recipient-1', phone: '14155552671' }],
    }));
    expect(errors[0]?.children?.[0]?.children).toHaveLength(2);
  });
});
