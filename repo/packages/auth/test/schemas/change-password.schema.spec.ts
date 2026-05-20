/**
 * Tests for @insurtech/auth/schemas/change-password
 */

import { describe, it, expect } from 'vitest';
import { changePasswordSchema } from '../../src/schemas/change-password.schema.js';

describe('changePasswordSchema', () => {
  it('accepts valid payload', () => {
    expect(() =>
      changePasswordSchema.parse({
        current_password: 'OldP@ssw0rd!1',
        new_password: 'NewStrongP@ss22!',
      }),
    ).not.toThrow();
  });

  it('rejects when new equals current', () => {
    expect(() =>
      changePasswordSchema.parse({
        current_password: 'SameP@ssw0rd!',
        new_password: 'SameP@ssw0rd!',
      }),
    ).toThrow(/differ/);
  });

  it('rejects weak new password', () => {
    expect(() =>
      changePasswordSchema.parse({
        current_password: 'OldP@ssw0rd!1',
        new_password: 'weak',
      }),
    ).toThrow();
  });
});
