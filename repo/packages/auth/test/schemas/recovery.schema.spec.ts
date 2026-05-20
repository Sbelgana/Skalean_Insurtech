/**
 * Tests for @insurtech/auth/schemas/recovery
 */

import { describe, it, expect } from 'vitest';
import {
  recoveryRequestSchema,
  recoveryConfirmSchema,
} from '../../src/schemas/recovery.schema.js';

describe('recoveryRequestSchema', () => {
  it('accepts valid email', () => {
    expect(() => recoveryRequestSchema.parse({ email: 'user@example.com' })).not.toThrow();
  });

  it('lowercases email', () => {
    const out = recoveryRequestSchema.parse({ email: 'USER@Example.COM' });
    expect(out.email).toBe('user@example.com');
  });

  it('rejects unknown fields', () => {
    expect(() => recoveryRequestSchema.parse({ email: 'a@b.co', extra: 'x' })).toThrow();
  });
});

describe('recoveryConfirmSchema', () => {
  it('accepts valid token + password', () => {
    expect(() =>
      recoveryConfirmSchema.parse({
        recovery_token: 'r'.repeat(60),
        new_password: 'StrongP@ssw0rd!',
      }),
    ).not.toThrow();
  });

  it('rejects weak password', () => {
    expect(() =>
      recoveryConfirmSchema.parse({
        recovery_token: 'r'.repeat(60),
        new_password: 'weak',
      }),
    ).toThrow();
  });

  it('rejects token too short', () => {
    expect(() =>
      recoveryConfirmSchema.parse({
        recovery_token: 'short',
        new_password: 'StrongP@ssw0rd!',
      }),
    ).toThrow();
  });
});
