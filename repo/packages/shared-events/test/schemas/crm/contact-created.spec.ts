import { describe, it, expect } from 'vitest';
import { ContactCreatedPayloadSchema } from '../../../src/schemas/crm/contact-created.schema.js';

describe('ContactCreatedPayloadSchema', () => {
  const valid = {
    contact_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    full_name: 'Mohamed Bennani',
    email: 'm.bennani@example.ma',
    phone: '+212600000000',
    preferred_language: 'fr-MA',
    preferred_channel: 'whatsapp',
    source: 'whatsapp_inbound',
    created_at: '2026-05-05T12:00:00.000Z',
    created_by_user_id: '33333333-3333-4333-9333-333333333333',
  };

  it('accepts valid payload', () => { expect(ContactCreatedPayloadSchema.safeParse(valid).success).toBe(true); });
  it('accepts null email', () => { expect(ContactCreatedPayloadSchema.safeParse({ ...valid, email: null }).success).toBe(true); });
  it('rejects invalid phone format', () => { expect(ContactCreatedPayloadSchema.safeParse({ ...valid, phone: '0600000000' }).success).toBe(false); });
  it('accepts ar-MA preferred_language', () => { expect(ContactCreatedPayloadSchema.safeParse({ ...valid, preferred_language: 'ar-MA' }).success).toBe(true); });
  it('accepts sms preferred_channel', () => { expect(ContactCreatedPayloadSchema.safeParse({ ...valid, preferred_channel: 'sms' }).success).toBe(true); });
  it('rejects unknown source', () => { expect(ContactCreatedPayloadSchema.safeParse({ ...valid, source: 'pigeon' }).success).toBe(false); });
});
