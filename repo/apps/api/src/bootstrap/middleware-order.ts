/**
 * Middleware order documentation -- ordre attendu pour Taches 1.3.5 a 1.3.14.
 *
 * Cet ordre est CRITIQUE. Chaque middleware suppose que le precedent a deja
 * pose des donnees dans la request. Modifier l'ordre = bugs subtils en prod.
 *
 * Ordre canonique :
 *   1. Helmet headers (security headers AVANT tout)
 *   2. CORS preflight (OPTIONS handled here)
 *   3. Compression (Brotli/gzip pour responses)
 *   4. RequestId middleware (genere x-request-id pour correlation logs)
 *   5. Logger Pino http (auto-log requests avec request-id)
 *   6. Body parser (JSON, urlencoded, multipart)
 *   7. Rate limit (per IP/user/tenant)
 *   8. Tenant context interceptor (lit x-tenant-id header)
 *   9. Auth guard (JWT/MFA -- Sprint 5)
 *  10. RBAC guard (12 roles -- Sprint 7)
 *  11. ZodValidationPipe (validate body/query/params)
 *  12. Controller handler
 *  13. ResponseInterceptor (wrap response { data, meta })
 *  14. ExceptionFilter (catch errors, redact PII)
 *
 * Reference : decision-002 (Multi-tenant) + decision-006 (no-emoji).
 * Tache : 1.3.1 pose la doc, 1.3.5 a 1.3.14 implementent.
 */

import type { INestApplication } from '@nestjs/common';

/**
 * Placeholder qui sera enrichi par chaque tache.
 * Tache 1.3.1 : function vide (juste signature).
 * Tache 1.3.5 : ajoute Helmet + CORS + compression.
 * Tache 1.3.6 : ajoute RequestId + Logger HTTP.
 * Tache 1.3.7 : ajoute body parsers fastify.
 * Tache 1.3.8 : ajoute Rate Limit Redis.
 * Tache 1.3.9 : ajoute TenantContextInterceptor.
 * Tache 1.3.10 : ajoute AuthGuard JWT (placeholder Sprint 5).
 * Tache 1.3.11 : ajoute RBACGuard (placeholder Sprint 7).
 * Tache 1.3.12 : ajoute ZodValidationPipe global.
 * Tache 1.3.13 : ajoute ResponseInterceptor global.
 * Tache 1.3.14 : ajoute ExceptionFilter global.
 */
export async function applyGlobalMiddlewares(app: INestApplication): Promise<void> {
  // Tache 1.3.1 : aucun middleware applique. Documentation pour suite.
  void app;
}

/**
 * Constante exportee pour les tests : ordre attendu.
 * Les tests verifient que chaque middleware est applique dans le bon ordre.
 */
export const EXPECTED_MIDDLEWARE_ORDER = [
  'helmet',
  'cors',
  'compression',
  'request-id',
  'logger-http',
  'body-parser',
  'rate-limit',
  'tenant-context',
  'auth-guard',
  'rbac-guard',
  'zod-validation-pipe',
  'response-interceptor',
  'exception-filter',
] as const;

export type MiddlewareName = (typeof EXPECTED_MIDDLEWARE_ORDER)[number];
