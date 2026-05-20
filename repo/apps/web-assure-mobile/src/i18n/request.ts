/**
 * next-intl server request config -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * buildRequestConfig() est exporte pour les tests unitaires.
 * getRequestConfig() est le point d'entree utilise par next-intl/plugin.
 *
 * Module-level const preserves string literal types so @formatjs can verify
 * style/'currency'/'percent' against its NumberFormatOptionsStyleRegistry.
 */
import type { AbstractIntlMessages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

const INTL_FORMATS = {
  number: {
    currency: { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 },
    percent: { style: 'percent', maximumFractionDigits: 1 },
  },
  dateTime: {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  },
} as const;

export interface RequestConfigResult {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
  now: Date;
  formats: typeof INTL_FORMATS;
}

export async function buildRequestConfig(requestLocale: Promise<string | undefined>) {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  let messages: AbstractIntlMessages;
  try {
    messages = (await import(`../messages/${locale}.json`)).default as AbstractIntlMessages;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`[i18n] Failed to load messages for locale ${locale}: ${(error as Error).message}`);
    }
    locale = routing.defaultLocale;
    messages = (await import(`../messages/${routing.defaultLocale}.json`)).default as AbstractIntlMessages;
  }

  return {
    locale,
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: INTL_FORMATS,
  };
}

export default getRequestConfig(async ({ requestLocale }) => {
  return buildRequestConfig(requestLocale);
});
