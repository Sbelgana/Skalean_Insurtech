/**
 * Tests for @insurtech/auth/schemas/mfa
 */

import { describe, it, expect } from 'vitest';
import {
  mfaVerifySchema,
  mfaSetupConfirmSchema,
  mfaDisableSchema,
} from '../../src/schemas/mfa.schema.js';

describe('mfaVerifySchema', () => {
  it('accepts totp_code 6 digits', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '123456' }),
    ).not.toThrow();
  });

  it('accepts recovery_code 10 alphanumeric uppercase', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), recovery_code: 'ABC123XYZ7' }),
    ).not.toThrow();
  });

  it('rejects when both totp_code and recovery_code are provided', () => {
    expect(() =>
      mfaVerifySchema.parse({
        challenge_token: 'a'.repeat(40),
        totp_code: '123456',
        recovery_code: 'ABC123XYZ7',
      }),
    ).toThrow();
  });

  it('rejects when neither totp_code nor recovery_code is provided', () => {
    expect(() => mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40) })).toThrow();
  });

  it('rejects totp_code with letters', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '12345A' }),
    ).toThrow();
  });

  it('rejects totp_code with 5 or 7 digits', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '12345' }),
    ).toThrow();
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '1234567' }),
    ).toThrow();
  });

  it('rejects recovery_code lowercase', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), recovery_code: 'abc123xyz7' }),
    ).toThrow();
  });
});

describe('mfaSetupConfirmSchema', () => {
  it('accepts valid setup confirmation', () => {
    expect(() =>
      mfaSetupConfirmSchema.parse({ setup_token: 's'.repeat(40), totp_code: '123456' }),
    ).not.toThrow();
  });

  it('rejects setup_token too short', () => {
    expect(() =>
      mfaSetupConfirmSchema.parse({ setup_token: 'short', totp_code: '123456' }),
    ).toThrow();
  });
});

describe('mfaDisableSchema', () => {
  it('accepts valid disable payload', () => {
    expect(() =>
      mfaDisableSchema.parse({ current_password: 'StrongP@ssw0rd!', totp_code: '123456' }),
    ).not.toThrow();
  });

  it('rejects without current_password', () => {
    expect(() => mfaDisableSchema.parse({ totp_code: '123456' })).toThrow();
  });
});
