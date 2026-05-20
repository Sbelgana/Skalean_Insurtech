/**
 * Tests for @insurtech/auth/schemas/refresh
 */

import { describe, it, expect } from 'vitest';
import { refreshSchema } from '../../src/schemas/refresh.schema.js';

describe('refreshSchema', () => {
  it('accepts a base64url-like token', () => {
    expect(() => refreshSchema.parse({ refresh_token: 'a'.repeat(60) })).not.toThrow();
  });

  it('rejects when too short', () => {
    expect(() => refreshSchema.parse({ refresh_token: 'short' })).toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() =>
      refreshSchema.parse({ refresh_token: 'a'.repeat(60), other: 'x' }),
    ).toThrow();
  });

  it('rejects characters outside base64url alphabet', () => {
    expect(() => refreshSchema.parse({ refresh_token: `${'a'.repeat(60)}/` })).toThrow();
  });
});
