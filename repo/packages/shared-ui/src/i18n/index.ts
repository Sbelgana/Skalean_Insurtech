/**
 * Barrel export i18n -- @insurtech/shared-ui
 * Reference : task-1.4.11 Sprint 4 Phase 1
 */
export {
  routing,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  RTL_LOCALES,
  isRtl,
  getDirection,
} from './routing';
export type { SupportedLocale, RtlLocale, Pathnames } from './routing';

export { LOCALES, getLocaleConfig, getLocaleFontStack } from './locales';
export type { LocaleConfig } from './locales';

export { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } from './navigation';
export type { AppRouter } from './navigation';

export type { AppName, MessageKey } from './types';
