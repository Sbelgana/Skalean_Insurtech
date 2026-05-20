/**
 * Tests for @insurtech/auth/services/pepper.service
 * Sprint 5 Tache 2.1.2
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PepperService } from '../../src/services/pepper.service.js';

describe('PepperService', () => {
  const SAVED_ENV: Record<string, string | undefined> = {};
  const KEYS = ['PASSWORD_PEPPER', 'PASSWORD_PEPPER_VERSION', 'PASSWORD_PEPPER_V2'];

  beforeEach(() => {
    for (const k of KEYS) {
      SAVED_ENV[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (SAVED_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = SAVED_ENV[k];
    }
  });

  it('throws if PASSWORD_PEPPER is missing', () => {
    expect(() => new PepperService()).toThrow(/PASSWORD_PEPPER/);
  });

  it('throws if PASSWORD_PEPPER is too short', () => {
    process.env['PASSWORD_PEPPER'] = 'short';
    expect(() => new PepperService()).toThrow(/at least 32/);
  });

  it('returns the configured pepper as current', () => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '1';
    const svc = new PepperService();
    expect(svc.getCurrentPepper()).toBe('a'.repeat(48));
    expect(svc.getCurrentVersion()).toBe(1);
    expect(svc.hasVersion(1)).toBe(true);
  });

  it('exposes v2 when set', () => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_V2'] = 'b'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '2';
    const svc = new PepperService();
    expect(svc.getCurrentPepper()).toBe('b'.repeat(48));
    expect(svc.hasVersion(1)).toBe(true);
    expect(svc.hasVersion(2)).toBe(true);
    expect(svc.getPepperByVersion(1)).toBe('a'.repeat(48));
  });

  it('throws if current version not configured', () => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '5';
    expect(() => new PepperService()).toThrow(/no pepper is configured/);
  });

  it('throws on invalid version', () => {
    process.env['PASSWORD_PEPPER'] = 'a'.repeat(48);
    process.env['PASSWORD_PEPPER_VERSION'] = '-1';
    expect(() => new PepperService()).toThrow(/must be a positive integer/);
  });
});
