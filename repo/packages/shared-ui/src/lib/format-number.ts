/**
 * Helpers de formatage de nombres locale-aware.
 *
 * Devise MAD (code ISO 4217), symbole "DH" en francais, "د.م." en arabe.
 */
import { LOCALES } from '../i18n/locales';

export type NumberFormatOptions = Intl.NumberFormatOptions & {
  useArabicIndicNumerals?: boolean;
};

function getEffectiveLocale(locale: string, useArabicIndic: boolean): string {
  const config = LOCALES.find((l) => l.code === locale);
  if (!config) return 'fr-FR';
  if (useArabicIndic && config.code === 'ar') {
    return 'ar-u-nu-arab';
  }
  return config.numberFormatLocale;
}

export function formatNumber(
  value: number,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  return new Intl.NumberFormat(effective, restOptions).format(value);
}

export function formatCurrency(
  value: number,
  locale: string,
  currency = 'MAD',
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  const formatter = new Intl.NumberFormat(effective, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...restOptions,
  });
  let result = formatter.format(value);
  if (currency === 'MAD' && (locale === 'fr' || locale.startsWith('fr-'))) {
    result = result.replace('MAD', 'DH');
  }
  return result;
}

export function formatPercent(
  value: number,
  locale: string,
  fractionDigits = 0,
): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(getEffectiveLocale(locale, false), {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCompact(
  value: number,
  locale: string,
  options: NumberFormatOptions = {},
): string {
  const { useArabicIndicNumerals = false, ...restOptions } = options;
  if (!Number.isFinite(value)) return '';
  const effective = getEffectiveLocale(locale, useArabicIndicNumerals);
  return new Intl.NumberFormat(effective, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    ...restOptions,
  }).format(value);
}

export function parseLocalizedNumber(
  text: string,
  _locale: string,
): number | null {
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
  const cleaned = text
    .replace(/[\s  ]/g, '')
    .replace(/[٠-٩]/g, (d) => String(arabicIndicDigits.indexOf(d)))
    .replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}
