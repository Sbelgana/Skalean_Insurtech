/**
 * E2E fixtures -- supported locales
 * Reference: task-1.4.16 Sprint 4 Phase 1
 */

export const LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const RTL_LOCALES: readonly Locale[] = ['ar-MA', 'ar'];

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Francais',
  'ar-MA': 'Darija (Maroc)',
  ar: 'Arabe classique',
};
