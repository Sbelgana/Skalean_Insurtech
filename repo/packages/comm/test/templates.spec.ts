/**
 * Tests for @insurtech/comm/templates
 * Sprint 5 Tache 2.1.13
 */

import { describe, expect, it } from 'vitest';
import {
  renderPasswordChanged,
  renderRecovery,
  renderVerify,
} from '../src/templates.js';

describe('renderVerify', () => {
  it('renders fr-MA verify email with placeholders', () => {
    const r = renderVerify('fr-MA', {
      display_name: 'Aicha',
      verify_url: 'https://app.skalean.ma/auth/verify-email?token=abc',
    });
    expect(r.subject).toContain('Skalean');
    expect(r.body).toContain('Aicha');
    expect(r.body).toContain('https://app.skalean.ma/auth/verify-email?token=abc');
  });

  it('renders en variant', () => {
    const r = renderVerify('en', {
      display_name: 'Alice',
      verify_url: 'https://example.com',
    });
    expect(r.subject).toContain('Welcome');
    expect(r.body).toContain('Alice');
  });

  it('supports all 4 locales', () => {
    for (const locale of ['fr-MA', 'fr-FR', 'ar-MA', 'en'] as const) {
      const r = renderVerify(locale, { display_name: 'X', verify_url: 'https://e.co' });
      expect(r.subject.length).toBeGreaterThan(5);
      expect(r.body.length).toBeGreaterThan(10);
    }
  });
});

describe('renderRecovery', () => {
  it('substitutes reset_url', () => {
    const r = renderRecovery('en', { reset_url: 'https://e.co/reset?token=xyz' });
    expect(r.body).toContain('https://e.co/reset?token=xyz');
  });
});

describe('renderPasswordChanged', () => {
  it('substitutes display_name', () => {
    const r = renderPasswordChanged('en', { display_name: 'Bob' });
    expect(r.body).toContain('Bob');
    expect(r.body).toContain('support@skalean.ma');
  });
});
