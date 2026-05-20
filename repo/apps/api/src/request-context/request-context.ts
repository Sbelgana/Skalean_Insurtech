/**
 * RequestContext -- store AsyncLocalStorage pour la propagation du contexte
 * de requete HTTP travers la chaine async (middleware -> service -> repo -> log).
 *
 * Champs :
 *   - request_id  : UUID genere ou transmis via X-Request-ID (idempotency + tracing).
 *   - tenant_id   : identifiant tenant Skalean (multi-tenant 3 niveaux, decision-002).
 *                   Provient de X-Tenant-ID header (Sprint 3) puis JWT (Sprint 5).
 *   - user_id     : identifiant utilisateur courant. Provient du JWT (Sprint 5).
 *   - trace_id    : identifiant trace OpenTelemetry W3C TraceContext (128 bits hex).
 *   - span_id     : identifiant span OpenTelemetry courant (64 bits hex).
 *
 * Usage dans un service :
 *   const ctx = getRequestContext();
 *   logger.info({ tenant_id: ctx?.tenant_id, request_id: ctx?.request_id }, 'action');
 *
 * Reference : decision-002 (multi-tenant) + decision-006 (no-emoji).
 * Tache : 1.3.4 (Sprint 3 / Phase 1).
 */
import { AsyncLocalStorage } from 'async_hooks';

/** Schema du contexte de requete propage par AsyncLocalStorage. */
export interface RequestContext {
  /** UUID de la requete -- genere si X-Request-ID absent. */
  request_id: string;
  /** Identifiant tenant Skalean (uuid). Optionnel avant auth (Sprint 5). */
  tenant_id?: string;
  /** Identifiant utilisateur courant (uuid). Optionnel avant auth (Sprint 5). */
  user_id?: string;
  /** Trace ID OpenTelemetry W3C (128 bits hex) pour correlation observabilite. */
  trace_id?: string;
  /** Span ID OpenTelemetry courant (64 bits hex). */
  span_id?: string;
}

/**
 * AsyncLocalStorage globale pour le contexte de requete.
 *
 * Le middleware `RequestContextMiddleware` appelle `.run()` a chaque requete HTTP,
 * propageant le store a toute la chaine async sans passer de parametres explicites.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Retourne le contexte de requete courant depuis AsyncLocalStorage.
 *
 * Retourne `undefined` si appele hors du contexte d'une requete HTTP
 * (ex : taches cron, workers, tests unitaires sans `.run()`).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
