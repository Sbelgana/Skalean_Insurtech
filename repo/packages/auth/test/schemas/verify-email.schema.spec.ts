/**
 * Tests for @insurtech/auth/schemas/verify-email
 */

import { describe, it, expect } from 'vitest';
import {
  verifyEmailSchema,
  resendVerificationSchema,
} from '../../src/schemas/verify-email.schema.js';

describe('verifyEmailSchema', () => {
  it('accepts valid token', () => {
    expect(() => verifyEmailSchema.parse({ verification_token: 'v'.repeat(60) })).not.toThrow();
  });

  it('rejects empty/short token', () => {
    expect(() => verifyEmailSchema.parse({ verification_token: 'short' })).toThrow();
  });
});

describe('resendVerificationSchema', () => {
  it('accepts and lowercases email', () => {
    const out = resendVerificationSchema.parse({ email: '  UserAt@Example.com  ' });
    expect(out.email).toBe('userat@example.com');
  });

  it('rejects unknown fields', () => {
    expect(() =>
      resendVerificationSchema.parse({ email: 'a@b.co', other: 'x' }),
    ).toThrow();
  });
});
