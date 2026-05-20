import { describe, it, expect } from 'vitest';
import { getDirectionFromLocale } from '../useDirection';

describe('getDirectionFromLocale', () => {
  it('returns rtl for ar', () => {
    expect(getDirectionFromLocale('ar')).toBe('rtl');
  });
  it('returns rtl for ar-MA', () => {
    expect(getDirectionFromLocale('ar-MA')).toBe('rtl');
  });
  it('returns ltr for fr', () => {
    expect(getDirectionFromLocale('fr')).toBe('ltr');
  });
  it('returns ltr for unknown locale', () => {
    expect(getDirectionFromLocale('es')).toBe('ltr');
  });
  it('returns ltr for en', () => {
    expect(getDirectionFromLocale('en')).toBe('ltr');
  });
});
