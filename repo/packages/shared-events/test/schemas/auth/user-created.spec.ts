import { describe, it, expect } from 'vitest';
import { UserCreatedPayloadSchema } from '../../../src/schemas/auth/user-created.schema.js';

describe('UserCreatedPayloadSchema', () => {
  const valid = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    email: 'admin@example.ma',
    full_name: 'Admin User',
    role: 'admin',
    locale: 'fr-MA',
    created_at: '2026-05-05T12:00:00.000Z',
    created_by_user_id: null,
    invitation_token_hash: null,
  };

  it('accepts valid payload', () => { expect(UserCreatedPayloadSchema.safeParse(valid).success).toBe(true); });
  it('rejects invalid email', () => { expect(UserCreatedPayloadSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false); });
  it('rejects unknown role', () => { expect(UserCreatedPayloadSchema.safeParse({ ...valid, role: 'god' }).success).toBe(false); });
  it('accepts ar-MA locale', () => { expect(UserCreatedPayloadSchema.safeParse({ ...valid, locale: 'ar-MA' }).success).toBe(true); });
  it('rejects unknown locale', () => { expect(UserCreatedPayloadSchema.safeParse({ ...valid, locale: 'es-ES' }).success).toBe(false); });
  it('rejects empty full_name', () => { expect(UserCreatedPayloadSchema.safeParse({ ...valid, full_name: '' }).success).toBe(false); });
});
