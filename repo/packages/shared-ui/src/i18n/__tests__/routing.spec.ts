import { describe, it, expect } from 'vitest';
import { routing, SUPPORTED_LOCALES, DEFAULT_LOCALE, isRtl, getDirection } from '../routing';

describe('i18n/routing', () => {
  it('exposes 3 locales fr, ar-MA, ar', () => {
    expect(routing.locales).toEqual(['fr', 'ar-MA', 'ar']);
    expect(SUPPORTED_LOCALES).toHaveLength(3);
  });

  it('uses fr as defaultLocale and localePrefix always', () => {
    expect(routing.defaultLocale).toBe('fr');
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(routing.localePrefix).toBe('always');
  });

  it('isRtl true for ar / ar-MA, false for fr', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ar-MA')).toBe(true);
    expect(isRtl('fr')).toBe(false);
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('fr')).toBe('ltr');
  });
});
