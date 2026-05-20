/**
 * Helper de classification de route pour middleware tenant context.
 *
 * Discipline : ordre des checks importe (specifique avant general).
 * /api/v1/admin/* doit etre verifie AVANT /api/v1/* default.
 *
 * Reference : Sprint 6 / Tache 2.2.2.
 */

import { RouteCategory } from '../types/route-category.type.js';

const INFRASTRUCTURE_PREFIXES = [
  '/healthz',
  '/readyz',
  '/livez',
  '/metrics',
  '/docs',
  '/docs-json',
  '/openapi.json',
  '/admin-queue',
];
const PUBLIC_PREFIX = '/api/v1/public/';
const ADMIN_PREFIX = '/api/v1/admin/';
const ASSURE_PREFIX = '/api/v1/assure/';
const AUTH_PUBLIC_PATHS = new Set([
  '/api/v1/auth/signup',
  '/api/v1/auth/signin',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
]);

/**
 * Classifie une route HTTP path en categorie pour le branchement middleware.
 *
 * Le path est compare en lowercase pour eviter case-sensitivity issues.
 * Query string est strippee avant classification.
 */
export function classifyRoute(path: string): RouteCategory {
  const cleanPath = path.split('?')[0]?.toLowerCase() ?? '';

  for (const prefix of INFRASTRUCTURE_PREFIXES) {
    if (cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) {
      return RouteCategory.Infrastructure;
    }
  }

  if (AUTH_PUBLIC_PATHS.has(cleanPath)) {
    return RouteCategory.Public;
  }

  if (cleanPath.startsWith(ADMIN_PREFIX)) {
    return RouteCategory.Admin;
  }

  if (cleanPath.startsWith(PUBLIC_PREFIX)) {
    return RouteCategory.Public;
  }

  if (cleanPath.startsWith(ASSURE_PREFIX)) {
    return RouteCategory.Assure;
  }

  return RouteCategory.Tenant;
}

export function categoryRequiresAuth(category: RouteCategory): boolean {
  return (
    category === RouteCategory.Admin ||
    category === RouteCategory.Assure ||
    category === RouteCategory.Tenant
  );
}

export function categoryRequiresTenantHeader(category: RouteCategory): boolean {
  return category === RouteCategory.Tenant || category === RouteCategory.Assure;
}
