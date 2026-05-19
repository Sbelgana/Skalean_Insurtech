import { describe, it, expect } from 'vitest';
import { UserSignedInPayloadSchema } from '../../../src/schemas/auth/user-signed-in.schema.js';

describe('UserSignedInPayloadSchema', () => {
  const validPayload = {
    user_id: '11111111-1111-4111-9111-111111111111',
    tenant_id: '22222222-2222-4222-9222-222222222222',
    signin_method: 'password',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    signed_in_at: '2026-05-05T12:00:00.000Z',
    session_id: '33333333-3333-4333-9333-333333333333',
    device_fingerprint: null,
    geo_country: null,
    geo_city: null,
  };

  it('accepts a valid payload', () => {
    expect(UserSignedInPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects missing user_id', () => {
    const { user_id: _u, ...rest } = validPayload;
    expect(UserSignedInPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid user_id format', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, user_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects unknown signin_method', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, signin_method: 'biometric' }).success).toBe(false);
  });

  it('accepts ipv4 address', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, ip_address: '10.0.0.1' }).success).toBe(true);
  });

  it('accepts ipv6 address', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, ip_address: '2001:db8::1' }).success).toBe(true);
  });

  it('rejects user_agent over 1024 chars', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, user_agent: 'x'.repeat(1025) }).success).toBe(false);
  });

  it('accepts geo_country with 2-letter code', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, geo_country: 'MA' }).success).toBe(true);
  });

  it('rejects geo_country longer than 2', () => {
    expect(UserSignedInPayloadSchema.safeParse({ ...validPayload, geo_country: 'MAR' }).success).toBe(false);
  });
});
