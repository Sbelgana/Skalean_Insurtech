/**
 * Configuration request next-intl : load messages dynamique depuis l'app courante.
 *
 * L'app courante detecee via process.env['NEXT_PUBLIC_APP_NAME'].
 * Fallback chain : locale -> ar (si ar-MA) -> fr (defaut absolu).
 */
import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { routing, DEFAULT_LOCALE, type SupportedLocale } from './routing';

const APP_NAME = process.env['NEXT_PUBLIC_APP_NAME'] ?? 'web-broker';

async function loadMessages(locale: SupportedLocale): Promise<AbstractIntlMessages> {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default as AbstractIntlMessages;
  } catch {
    if (locale === 'ar-MA') {
      return loadMessages('ar');
    }
    if (locale === 'ar') {
      return loadMessages('fr');
    }
    throw new Error(`[i18n][${APP_NAME}] Failed to load messages for locale '${locale}'`);
  }
}

function resolveLocale(requested: string | undefined): SupportedLocale {
  if (requested !== undefined && (routing.locales as ReadonlyArray<string>).includes(requested)) {
    return requested as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = resolveLocale(requested);
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const },
        medium: { day: '2-digit' as const, month: 'short' as const, year: 'numeric' as const },
        long: { day: '2-digit' as const, month: 'long' as const, year: 'numeric' as const, weekday: 'long' as const },
      },
      number: {
        currency: { style: 'currency' as const, currency: 'MAD', minimumFractionDigits: 2 },
        percent: { style: 'percent' as const, minimumFractionDigits: 0, maximumFractionDigits: 2 },
        compact: { notation: 'compact' as const, compactDisplay: 'short' as const },
      },
      list: {
        and: { style: 'long' as const, type: 'conjunction' as const },
        or: { style: 'long' as const, type: 'disjunction' as const },
      },
    },
    onError(error: { message: string }) {
      if (process.env['NODE_ENV'] === 'development') {
        console.warn(`[i18n][${APP_NAME}][${locale}]`, error.message);
      }
    },
    getMessageFallback({ namespace, key, error }: { namespace?: string; key: string; error: { code: string } }) {
      const path = [namespace, key].filter(Boolean).join('.');
      if (error.code === 'MISSING_MESSAGE') {
        return `[${path}]`;
      }
      return `[ERR:${path}]`;
    },
  };
});
