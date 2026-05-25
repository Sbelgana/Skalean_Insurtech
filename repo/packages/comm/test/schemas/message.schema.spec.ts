import { describe, expect, it } from 'vitest';
import {
  SendMessageSchema,
  MessageFiltersSchema,
  BatchSendSchema,
  UpdateStatusSchema,
} from '../../src/schemas/message.schema.js';
import { WebhookEventSchema } from '../../src/schemas/webhook.schema.js';

describe('SendMessageSchema', () => {
  it('accepts contactId-only input with default locale fr', () => {
    const out = SendMessageSchema.parse({
      contactId: '11111111-1111-1111-1111-111111111111',
      templateName: 'appointment_reminder',
    });
    expect(out.locale).toBe('fr');
    expect(out.variables).toEqual({});
  });

  it('accepts toAddress-only input (phone E.164)', () => {
    const out = SendMessageSchema.parse({
      toAddress: '+212612345678',
      templateName: 'auth_otp',
    });
    expect(out.toAddress).toBe('+212612345678');
  });

  it('rejects when neither contactId nor toAddress provided', () => {
    const result = SendMessageSchema.safeParse({ templateName: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects non-E.164 phone', () => {
    const result = SendMessageSchema.safeParse({
      toAddress: '0612345678',
      templateName: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('accepts ar-MA locale (darija)', () => {
    const out = SendMessageSchema.parse({
      contactId: '11111111-1111-1111-1111-111111111111',
      templateName: 'reminder',
      locale: 'ar-MA',
    });
    expect(out.locale).toBe('ar-MA');
  });

  it('accepts en locale (Sprint 9 extension)', () => {
    const out = SendMessageSchema.parse({
      contactId: '11111111-1111-1111-1111-111111111111',
      templateName: 'reminder',
      locale: 'en',
    });
    expect(out.locale).toBe('en');
  });

  it('rejects invalid locale', () => {
    const result = SendMessageSchema.safeParse({
      contactId: '11111111-1111-1111-1111-111111111111',
      templateName: 'reminder',
      locale: 'es',
    });
    expect(result.success).toBe(false);
  });
});

describe('MessageFiltersSchema', () => {
  it('parses cursor and limit defaults', () => {
    const out = MessageFiltersSchema.parse({});
    expect(out.limit).toBe(50);
  });

  it('caps limit at 200', () => {
    const result = MessageFiltersSchema.safeParse({ limit: 500 });
    expect(result.success).toBe(false);
  });

  it('coerces dateFrom from ISO string', () => {
    const out = MessageFiltersSchema.parse({ dateFrom: '2026-01-01' });
    expect(out.dateFrom).toBeInstanceOf(Date);
  });
});

describe('BatchSendSchema', () => {
  it('accepts batch of 1-1000 items', () => {
    const out = BatchSendSchema.parse({
      templateName: 'newsletter',
      items: [
        {
          contactId: '11111111-1111-1111-1111-111111111111',
          variables: { name: 'Mohamed' },
        },
      ],
    });
    expect(out.items.length).toBe(1);
  });

  it('rejects empty batch', () => {
    const result = BatchSendSchema.safeParse({
      templateName: 'newsletter',
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateStatusSchema', () => {
  it('accepts sent without failReason', () => {
    const out = UpdateStatusSchema.parse({
      messageId: '11111111-1111-1111-1111-111111111111',
      status: 'sent',
    });
    expect(out.status).toBe('sent');
  });

  it('requires failReason for status=failed', () => {
    const result = UpdateStatusSchema.safeParse({
      messageId: '11111111-1111-1111-1111-111111111111',
      status: 'failed',
    });
    expect(result.success).toBe(false);
  });

  it('requires failReason for status=bounced', () => {
    const result = UpdateStatusSchema.safeParse({
      messageId: '11111111-1111-1111-1111-111111111111',
      status: 'bounced',
    });
    expect(result.success).toBe(false);
  });

  it('accepts bounced with failReason', () => {
    const out = UpdateStatusSchema.parse({
      messageId: '11111111-1111-1111-1111-111111111111',
      status: 'bounced',
      failReason: 'hard_bounce: mailbox does not exist',
    });
    expect(out.status).toBe('bounced');
  });
});

describe('WebhookEventSchema', () => {
  it('parses Meta WA webhook payload', () => {
    const payload = {
      provider: 'meta' as const,
      object: 'whatsapp_business_account' as const,
      entry: [
        {
          id: 'waba-123',
          changes: [
            {
              field: 'messages' as const,
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { display_phone_number: '+212600000000', phone_number_id: 'pn-1' },
                statuses: [
                  {
                    id: 'wamid.xyz',
                    status: 'delivered' as const,
                    timestamp: '1730000000',
                    recipient_id: '212600000000',
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const out = WebhookEventSchema.parse(payload);
    expect(out.provider).toBe('meta');
  });

  it('parses Mailgun webhook payload', () => {
    const payload = {
      provider: 'mailgun' as const,
      signature: { timestamp: '1730000000', token: 't', signature: 's' },
      'event-data': {
        event: 'delivered' as const,
        id: 'ev-1',
        timestamp: 1730000000,
        message: { headers: { 'message-id': 'msg-1@mg.example.com' } },
      },
    };
    const out = WebhookEventSchema.parse(payload);
    expect(out.provider).toBe('mailgun');
  });
});
