'use client';
/**
 * useDirection -- detects RTL based on current locale
 * Reference : task-1.4.8 Sprint 4 Phase 1
 */
import { useLocale } from 'next-intl';

export type Direction = 'ltr' | 'rtl';

const RTL_LOCALES = new Set(['ar', 'ar-MA']);

export function useDirection(): Direction {
  const locale = useLocale();
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function getDirectionFromLocale(locale: string): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
