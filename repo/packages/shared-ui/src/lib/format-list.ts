/**
 * Helpers de formatage de listes locale-aware via Intl.ListFormat.
 *
 * fr conjunction : "Pierre, Paul et Jacques"
 * ar conjunction : "بيير وبول وجاك"
 */
import { LOCALES } from '../i18n/locales';

export type ListType = 'conjunction' | 'disjunction' | 'unit';
export type ListStyle = 'long' | 'short' | 'narrow';

function getEffectiveLocale(locale: string): string {
  return LOCALES.find((l) => l.code === locale)?.numberFormatLocale ?? 'fr-FR';
}

export function formatList(
  items: ReadonlyArray<string>,
  locale: string,
  type: ListType = 'conjunction',
  style: ListStyle = 'long',
): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  return new Intl.ListFormat(getEffectiveLocale(locale), { type, style }).format(items);
}

export function formatListAnd(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'conjunction', 'long');
}

export function formatListOr(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'disjunction', 'long');
}

export function formatListUnit(items: ReadonlyArray<string>, locale: string): string {
  return formatList(items, locale, 'unit', 'short');
}
