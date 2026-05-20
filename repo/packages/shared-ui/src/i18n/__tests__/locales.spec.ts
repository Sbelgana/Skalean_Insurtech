import { describe, it, expect } from 'vitest';
import { LOCALES, getLocaleConfig, getLocaleFontStack } from '../locales';

describe('i18n/locales', () => {
  it('has 3 locales', () => {
    expect(LOCALES).toHaveLength(3);
  });

  it('fr is ltr, ar is rtl, ar-MA is rtl', () => {
    const fr = getLocaleConfig('fr');
    const ar = getLocaleConfig('ar');
    const arMA = getLocaleConfig('ar-MA');
    expect(fr.dir).toBe('ltr');
    expect(ar.dir).toBe('rtl');
    expect(arMA.dir).toBe('rtl');
  });

  it('getLocaleConfig throws for unknown locale', () => {
    expect(() => getLocaleConfig('de')).toThrow('[i18n] Unsupported locale');
  });

  it('ar uses arab numbering system, fr uses latn', () => {
    expect(getLocaleConfig('ar').numberingSystem).toBe('arab');
    expect(getLocaleConfig('fr').numberingSystem).toBe('latn');
  });

  it('getLocaleFontStack returns fontFamily string', () => {
    const font = getLocaleFontStack('fr');
    expect(font).toContain('montserrat');
  });
});
