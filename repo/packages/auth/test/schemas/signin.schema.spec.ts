/**
 * Tests for @insurtech/auth/schemas/signin
 */

import { describe, it, expect } from 'vitest';
import { signinSchema } from '../../src/schemas/signin.schema.js';

describe('signinSchema', () => {
  const valid = { email: 'user@example.com', password: 'StrongP@ssw0rd!' };

  it('accepts minimal valid payload', () => {
    expect(() => signinSchema.parse(valid)).not.toThrow();
  });

  it('defaults remember_me to false', () => {
    const out = signinSchema.parse(valid);
    expect(out.remember_me).toBe(false);
  });

  it('accepts remember_me=true', () => {
    const out = signinSchema.parse({ ...valid, remember_me: true });
    expect(out.remember_me).toBe(true);
  });

  it('accepts optional mfa_code', () => {
    expect(() => signinSchema.parse({ ...valid, mfa_code: '123456' })).not.toThrow();
  });

  it('rejects when both mfa_code and recovery_code are provided', () => {
    expect(() =>
      signinSchema.parse({ ...valid, mfa_code: '123456', recovery_code: 'ABC123XYZ7' }),
    ).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    expect(() => signinSchema.parse({ ...valid, extra: 'x' })).toThrow();
  });
});
