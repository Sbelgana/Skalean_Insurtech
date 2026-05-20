/**
 * Tests for @insurtech/auth/schemas/signup
 * Sprint 5 Tache 2.1.1
 */

import { describe, it, expect } from 'vitest';
import { signupSchema, safeParseSignup } from '../../src/schemas/signup.schema.js';

describe('signupSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'StrongP@ssw0rd!',
    display_name: 'Aicha Bennani',
    locale: 'fr-MA',
    accepted_tos: true,
  };

  it('accepts a valid payload', () => {
    expect(() => signupSchema.parse(valid)).not.toThrow();
  });

  it('rejects payload missing accepted_tos', () => {
    const bad = { ...valid, accepted_tos: undefined };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects accepted_tos = false', () => {
    const bad = { ...valid, accepted_tos: false };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects password too short', () => {
    const bad = { ...valid, password: 'Short1!' };
    expect(() => signupSchema.parse(bad)).toThrow(/at least 12 characters/);
  });

  it('rejects password missing uppercase', () => {
    const bad = { ...valid, password: 'lowercase1234!' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects password missing special char', () => {
    const bad = { ...valid, password: 'NoSpecial1234ab' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects email with cyrillic homograph', () => {
    const bad = { ...valid, email: 'user@gооgle.com' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('lowercases and trims email', () => {
    const out = signupSchema.parse({ ...valid, email: '   USER@Example.COM   ' });
    expect(out.email).toBe('user@example.com');
  });

  it('rejects unknown fields (strict)', () => {
    const bad = { ...valid, role: 'super_admin_platform' };
    expect(() => signupSchema.parse(bad)).toThrow(/Unrecognized key/);
  });

  it('rejects locale not in enum', () => {
    const bad = { ...valid, locale: 'es-ES' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('safeParseSignup returns success structure on valid', () => {
    const r = safeParseSignup(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@example.com');
  });

  it('safeParseSignup returns errors structure on invalid', () => {
    const r = safeParseSignup({ ...valid, password: 'weak' });
    expect(r.success).toBe(false);
  });
});
