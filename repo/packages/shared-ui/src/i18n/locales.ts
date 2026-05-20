/**
 * Metadata des locales supportees Skalean InsurTech.
 * Source de verite pour LocaleSwitcher, DirectionProvider, format-* helpers.
 */
import type { SupportedLocale } from './routing';

export type LocaleConfig = {
  code: SupportedLocale;
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  dateFormat: string;
  numberFormatLocale: string;
  fontFamily: string;
  flagPath: string;
  numberingSystem: 'latn' | 'arab';
  pluralCategories: ReadonlyArray<Intl.LDMLPluralRule>;
};

export const LOCALES: ReadonlyArray<LocaleConfig> = [
  {
    code: 'fr',
    nativeName: 'Francais',
    englishName: 'French',
    dir: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'fr-FR',
    fontFamily: 'var(--font-montserrat), system-ui, sans-serif',
    flagPath: '/flags/fr.svg',
    numberingSystem: 'latn',
    pluralCategories: ['one', 'other'],
  },
  {
    code: 'ar-MA',
    nativeName: 'الدارجة المغربية',
    englishName: 'Moroccan Darija',
    dir: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'ar-MA',
    fontFamily: 'var(--font-noto-naskh-arabic), var(--font-montserrat), Tahoma, sans-serif',
    flagPath: '/flags/ar-MA.svg',
    numberingSystem: 'latn',
    pluralCategories: ['zero', 'one', 'two', 'few', 'many', 'other'],
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic (Modern Standard)',
    dir: 'rtl',
    dateFormat: 'dd/MM/yyyy',
    numberFormatLocale: 'ar',
    fontFamily: 'var(--font-noto-naskh-arabic), Tahoma, "Geeza Pro", sans-serif',
    flagPath: '/flags/ar.svg',
    numberingSystem: 'arab',
    pluralCategories: ['zero', 'one', 'two', 'few', 'many', 'other'],
  },
] as const;

export function getLocaleConfig(code: string): LocaleConfig {
  const config = LOCALES.find((l) => l.code === code);
  if (!config) {
    throw new Error(
      `[i18n] Unsupported locale '${code}'. Supported: ${LOCALES.map((l) => l.code).join(', ')}`,
    );
  }
  return config;
}

export function getLocaleFontStack(code: string): string {
  return getLocaleConfig(code).fontFamily;
}
