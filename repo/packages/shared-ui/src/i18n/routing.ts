/**
 * Configuration routing next-intl partage entre les 7 apps Skalean InsurTech.
 *
 * Reference : task-1.4.11 Sprint 4 Phase 1
 * Decision-009 : 3 locales obligatoires fr / ar-MA / ar
 */
import { defineRouting } from 'next-intl/routing';

export const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'fr';

export const RTL_LOCALES = ['ar', 'ar-MA'] as const;
export type RtlLocale = (typeof RTL_LOCALES)[number];

export function isRtl(locale: string): locale is RtlLocale {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  alternateLinks: true,
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
  },
});

export type Pathnames =
  | '/'
  | '/dashboard'
  | '/contacts'
  | '/policies'
  | '/claims'
  | '/settings'
  | '/auth/login'
  | '/auth/logout';
