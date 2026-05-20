/**
 * RateLimitGuard -- guard global rate-limit (extension de ThrottlerGuard).
 *
 * Fonctionnalites supplementaires vs ThrottlerGuard de base :
 *   1. shouldSkip() : exempte /healthz, /readyz, /docs (probes K8s + Swagger UI).
 *   2. throwThrottlingException() : HTTP 429 avec payload JSON structure
 *      { error, code: 'RATE_LIMIT', retryAfter, traceId } conforme format API Skalean.
 *
 * Le headerPrefix 'X-RateLimit' est conserve (comportement par defaut du parent).
 * Headers positionnes par ThrottlerGuard.handleRequest() :
 *   - X-RateLimit-Limit    : limite maximale de la fenetre
 *   - X-RateLimit-Remaining : requetes restantes dans la fenetre
 *   - X-RateLimit-Reset    : secondes avant expiration de la fenetre
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.13 (Sprint 3 / Phase 1).
 */
import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * Prefixes de routes exemptes du rate-limit.
 * Doivent correspondre exactement a la racine du chemin (insensible aux query params).
 */
const SKIP_PATH_PREFIXES = ['/healthz', '/readyz', '/docs'] as const;

/**
 * Payload HTTP 429 retourne par le guard en cas de depassement de limite.
 * Conforme au format d'erreur de l'API Skalean InsurTech (AllExceptionsFilter).
 */
interface RateLimitErrorBody {
  error: string;
  code: 'RATE_LIMIT';
  retryAfter: number;
  traceId: string;
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Exempte les routes systeme et de documentation du rate-limit.
   *
   * Routes exemptes :
   *   - /healthz       : liveness probe K8s (appele toutes les 10s par kubelet)
   *   - /readyz        : readiness probe K8s (appele toutes les 10s)
   *   - /docs          : Swagger UI + /docs-json + /docs-yaml
   *
   * Sans cette exemption, les probes K8s declencheraient rapidement le rate-limit
   * en production (kubelet : 6 appels/minute par defaut).
   */
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const { req } = this.getRequestResponse(context);
    // req.url contient le chemin + query string (ex : /healthz?token=abc).
    const rawUrl = (req as Record<string, unknown>)['url'] as string | undefined ?? '';
    // On ne compare que le chemin (avant le '?').
    const path = rawUrl.split('?')[0] ?? '';

    return SKIP_PATH_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  /**
   * Leve HTTP 429 avec un payload JSON structure conforme a l'API Skalean.
   *
   * Le payload inclut :
   *   - error      : message lisible
   *   - code       : 'RATE_LIMIT' (pour discrimination cote client)
   *   - retryAfter : secondes avant que la limite soit remise a zero
   *   - traceId    : identifiant de requete Fastify (req.id) pour debug/audit
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { req } = this.getRequestResponse(context);

    // req.id est positionne par Fastify (uuid v4 genere automatiquement si pas de header).
    const traceId =
      ((req as Record<string, unknown>)['id'] as string | undefined) ?? 'unknown';

    const body: RateLimitErrorBody = {
      error: 'Too many requests',
      code: 'RATE_LIMIT',
      retryAfter: throttlerLimitDetail.timeToExpire,
      traceId,
    };

    throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
  }
}
