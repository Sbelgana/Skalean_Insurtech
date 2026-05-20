/**
 * i18n routing re-export -- web-broker
 * Reutilise la config partagee depuis @insurtech/shared-ui.
 * Reference : task-1.4.11 Sprint 4 Phase 1
 */
export {
  routing,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isRtl,
  getDirection,
} from '@insurtech/shared-ui/i18n/routing';
export type { SupportedLocale, RtlLocale } from '@insurtech/shared-ui/i18n/routing';
export { Link, redirect, usePathname, useRouter, getPathname } from '@insurtech/shared-ui/i18n/navigation';
export type { AppRouter } from '@insurtech/shared-ui/i18n/navigation';

// Backward-compat alias
export type AppLocale = import('@insurtech/shared-ui/i18n/routing').SupportedLocale;
