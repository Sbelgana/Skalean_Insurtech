/**
 * Helpers de formatage de dates locale-aware avec timezone Africa/Casablanca.
 *
 * DST Africa/Casablanca : -1h pendant Ramadan (gere par IANA tz database).
 * Format dd/MM/yyyy force pour eviter ambiguite.
 */
import { LOCALES } from '../i18n/locales';

const DEFAULT_TIMEZONE = 'Africa/Casablanca';

function getEffectiveLocale(locale: string): string {
  const config = LOCALES.find((l) => l.code === locale);
  return config?.numberFormatLocale ?? 'fr-FR';
}

export type DateFormatStyle = 'short' | 'medium' | 'long' | 'full';

const STYLE_OPTIONS: Record<DateFormatStyle, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: '2-digit', year: 'numeric' },
  medium: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' },
  full: { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long', era: 'short' },
};

export function formatDate(
  date: Date | string | number,
  locale: string,
  style: DateFormatStyle = 'short',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const effectiveLocale = getEffectiveLocale(locale);
  const formatter = new Intl.DateTimeFormat(effectiveLocale, {
    ...STYLE_OPTIONS[style],
    timeZone,
  });
  return formatter.format(dateObj);
}

export function formatTime(
  date: Date | string | number,
  locale: string,
  withSeconds = false,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat(getEffectiveLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds && { second: '2-digit' }),
    hour12: false,
    timeZone,
  });
  return formatter.format(dateObj);
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: string,
  baseTime?: Date,
): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const base = baseTime ?? new Date();
  const diffMs = dateObj.getTime() - base.getTime();
  const formatter = new Intl.RelativeTimeFormat(getEffectiveLocale(locale), {
    numeric: 'auto',
    style: 'long',
  });
  const absSeconds = Math.abs(diffMs) / 1000;
  const sign = diffMs < 0 ? -1 : 1;
  if (absSeconds < 60) return formatter.format(sign * Math.round(absSeconds), 'second');
  if (absSeconds < 3600) return formatter.format(sign * Math.round(absSeconds / 60), 'minute');
  if (absSeconds < 86400) return formatter.format(sign * Math.round(absSeconds / 3600), 'hour');
  if (absSeconds < 2592000) return formatter.format(sign * Math.round(absSeconds / 86400), 'day');
  if (absSeconds < 31536000) return formatter.format(sign * Math.round(absSeconds / 2592000), 'month');
  return formatter.format(sign * Math.round(absSeconds / 31536000), 'year');
}

export function formatDateRange(
  start: Date | string | number,
  end: Date | string | number,
  locale: string,
  style: DateFormatStyle = 'short',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat(getEffectiveLocale(locale), {
    ...STYLE_OPTIONS[style],
    timeZone,
  });
  return formatter.formatRange(startDate, endDate);
}
