/**
 * Middleware next-intl -- web-customer-portal
 * Reference : task-1.4.5 Sprint 4 Phase 1
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg|manifest\\.webmanifest|robots\\.txt|icons|sitemap\\.xml).*)',
  ],
};
