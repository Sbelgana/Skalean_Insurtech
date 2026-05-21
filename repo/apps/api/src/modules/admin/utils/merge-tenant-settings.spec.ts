import type { TenantSettings } from '@insurtech/auth';
import { describe, expect, it } from 'vitest';
import { mergeTenantSettings } from './merge-tenant-settings.js';

const baseline: TenantSettings = {
  locale: 'fr',
  timezone: 'Africa/Casablanca',
  currency: 'MAD',
  branding: { primaryColor: '#E95D2C', logoUrl: null },
  features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
  quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
  tenantType: 'broker',
};

describe('mergeTenantSettings', () => {
  it('1. preserves existing fields when partial empty', () => {
    expect(mergeTenantSettings(baseline, {})).toEqual(baseline);
  });

  it('2. overwrites top-level locale', () => {
    const merged = mergeTenantSettings(baseline, { locale: 'ar-MA' });
    expect(merged.locale).toBe('ar-MA');
    expect(merged.currency).toBe('MAD');
  });

  it('3. partial branding preserves non-modified fields', () => {
    const merged = mergeTenantSettings(baseline, {
      branding: { primaryColor: '#FF0000' },
    });
    expect(merged.branding.primaryColor).toBe('#FF0000');
    expect(merged.branding.logoUrl).toBeNull();
  });

  it('4. partial features update', () => {
    const merged = mergeTenantSettings(baseline, {
      features: { mfaRequiredForAdmin: false },
    });
    expect(merged.features.mfaRequiredForAdmin).toBe(false);
    expect(merged.features.sinistreAutoAssign).toBe(false);
  });

  it('5. partial quotas update', () => {
    const merged = mergeTenantSettings(baseline, {
      quotas: { maxUsers: 50 },
    });
    expect(merged.quotas.maxUsers).toBe(50);
    expect(merged.quotas.maxPolices).toBe(1000);
  });

  it('6. multiple top-level fields update simultaneously', () => {
    const merged = mergeTenantSettings(baseline, {
      locale: 'en',
      currency: 'EUR',
      timezone: 'Europe/Paris',
    });
    expect(merged.locale).toBe('en');
    expect(merged.currency).toBe('EUR');
    expect(merged.timezone).toBe('Europe/Paris');
  });

  it('7. deep nested update branding + features', () => {
    const merged = mergeTenantSettings(baseline, {
      branding: { primaryColor: '#00FF00', logoUrl: 'https://example.ma/logo.png' },
      features: { sinistreAutoAssign: true },
    });
    expect(merged.branding.primaryColor).toBe('#00FF00');
    expect(merged.branding.logoUrl).toBe('https://example.ma/logo.png');
    expect(merged.features.sinistreAutoAssign).toBe(true);
    expect(merged.features.mfaRequiredForAdmin).toBe(true);
  });

  it('8. preserves originals (immutable)', () => {
    const original: TenantSettings = {
      ...baseline,
      branding: { ...baseline.branding },
    };
    mergeTenantSettings(original, { branding: { primaryColor: '#FFF' } });
    expect(original.branding.primaryColor).toBe('#E95D2C');
  });

  it('9. ice update', () => {
    const merged = mergeTenantSettings(baseline, { ice: '001122334455667' });
    expect(merged.ice).toBe('001122334455667');
  });

  it('10. tenantType update', () => {
    const merged = mergeTenantSettings(baseline, { tenantType: 'garage' });
    expect(merged.tenantType).toBe('garage');
  });
});
