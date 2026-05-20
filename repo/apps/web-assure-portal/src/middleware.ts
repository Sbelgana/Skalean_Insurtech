/**
 * Middleware next-intl pour web-assure-portal (port 3005).
 *
 * Detecte locale depuis URL prefix -> Cookie NEXT_LOCALE -> Accept-Language -> defaut fr.
 * Reference : task-1.4.11 Sprint 4 Phase 1
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from '@insurtech/shared-ui/i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|static|favicon\.ico|manifest\.webmanifest|robots\.txt|sitemap\.xml|icons|flags|.*\..*).*)',
  ],
};
