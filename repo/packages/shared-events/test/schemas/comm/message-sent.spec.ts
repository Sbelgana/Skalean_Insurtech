import { describe, it, expect } from 'vitest';
import { MessageSentPayloadSchema } from '../../../src/schemas/comm/message-sent.schema.js';

describe('MessageSentPayloadSchema', () => {
  const valid = {
    message_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    channel: 'whatsapp',
    to_address: '+212600000000',
    from_address: null,
    template_id: null,
    provider: 'meta_whatsapp',
    provider_message_id: 'wamid.HBgM',
    sent_at: '2026-05-05T12:00:00.000Z',
    related_resource_type: null,
    related_resource_id: null,
  };

  it('accepts valid payload', () => { expect(MessageSentPayloadSchema.safeParse(valid).success).toBe(true); });
  it('rejects unknown channel', () => { expect(MessageSentPayloadSchema.safeParse({ ...valid, channel: 'fax' }).success).toBe(false); });
  it('rejects unknown provider', () => { expect(MessageSentPayloadSchema.safeParse({ ...valid, provider: 'unknown' }).success).toBe(false); });
  it('accepts twilio+sms', () => { expect(MessageSentPayloadSchema.safeParse({ ...valid, channel: 'sms', provider: 'twilio' }).success).toBe(true); });
  it('accepts template_id uuid', () => { expect(MessageSentPayloadSchema.safeParse({ ...valid, template_id: '44444444-4444-4444-9444-444444444444' }).success).toBe(true); });
  it('rejects empty to_address', () => { expect(MessageSentPayloadSchema.safeParse({ ...valid, to_address: '' }).success).toBe(false); });
});
