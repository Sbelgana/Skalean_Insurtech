/**
 * i18n routing -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 */
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'ar-MA', 'ar'] as const,
  defaultLocale: 'fr',
  localePrefix: 'always',
});
