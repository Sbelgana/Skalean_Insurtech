/**
 * next-intl routing config -- web-customer-portal
 * Reference : task-1.4.5 Sprint 4 Phase 1
 */
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['fr', 'ar-MA', 'ar'] as const,
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
