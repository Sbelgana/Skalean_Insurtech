/**
 * Helper de pluralisation locale-aware via Intl.PluralRules.
 *
 * Arabe : 6 categories CLDR (zero, one, two, few, many, other).
 * Darija ar-MA : collapse few/many vers other par defaut.
 */
import { LOCALES } from '../i18n/locales';

export type PluralCategory = Intl.LDMLPluralRule;

const COLLAPSED_DARIJA_RULES: Record<PluralCategory, PluralCategory> = {
  zero: 'zero',
  one: 'one',
  two: 'other',
  few: 'other',
  many: 'other',
  other: 'other',
};

function getEffectiveLocale(locale: string): string {
  return LOCALES.find((l) => l.code === locale)?.numberFormatLocale ?? 'fr-FR';
}

export function getPluralCategory(
  count: number,
  locale: string,
  collapseDarija = true,
): PluralCategory {
  const effective = getEffectiveLocale(locale);
  const rules = new Intl.PluralRules(effective);
  const category = rules.select(count) as PluralCategory;
  if (locale === 'ar-MA' && collapseDarija) {
    return COLLAPSED_DARIJA_RULES[category];
  }
  return category;
}

export type PluralMessages = Partial<Record<PluralCategory, string>> & { other: string };

export function pluralize(
  count: number,
  locale: string,
  messages: PluralMessages,
  collapseDarija = true,
): string {
  const category = getPluralCategory(count, locale, collapseDarija);
  const template = messages[category] ?? messages.other;
  return template.replace(/#/g, String(count));
}

export function getPluralCategoriesForLocale(locale: string): ReadonlyArray<PluralCategory> {
  const config = LOCALES.find((l) => l.code === locale);
  if (!config) return ['one', 'other'];
  return config.pluralCategories;
}
