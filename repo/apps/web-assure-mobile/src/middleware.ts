/**
 * Middleware next-intl -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Sprint 5 (Auth) : ajoutera middleware compose (next-intl + next-auth).
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.webmanifest|robots\\.txt|icons|sw\\.js|workbox-.*|sitemap\\.xml|offline).*)',
  ],
};
