/**
 * RequestContextMiddleware -- middleware NestJS qui initialise le RequestContext
 * AsyncLocalStorage a chaque requete HTTP entrante.
 *
 * Ordre d'extraction :
 *   1. request_id : header X-Request-ID ou UUID genere (crypto.randomUUID).
 *   2. tenant_id  : header X-Tenant-ID (Sprint 3). Sera extrait du JWT Sprint 5.
 *   3. trace_id   : span OTel actif (context propagation W3C TraceContext).
 *   4. span_id    : span OTel actif.
 *
 * Le middleware appelle `requestContextStorage.run(ctx, next)` qui propage
 * le store a toute la chaine async sans pollution de signature de fonction.
 *
 * NestJS Fastify : `use(req, res, next)` recoit le raw IncomingMessage Node.js.
 * Les en-tetes sont accessibles via `req.headers`.
 *
 * Reference : decision-002 (multi-tenant) + decision-006 (no-emoji).
 * Tache : 1.3.4 (Sprint 3 / Phase 1).
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { trace } from '@opentelemetry/api';
import { requestContextStorage, type RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  /**
   * Initialise le RequestContext et propage via AsyncLocalStorage.
   *
   * @param req  - IncomingMessage Node.js (raw, avant parsing Fastify).
   * @param _res - ServerResponse Node.js (non utilise ici).
   * @param next - Callback NestJS (appele dans le .run() pour propager le store).
   */
  use(req: IncomingMessage, _res: ServerResponse, next: () => void): void {
    // Extraction X-Request-ID : respecte les header deja generes (proxy, gateway).
    const existingRequestId = req.headers['x-request-id'];
    const requestId =
      typeof existingRequestId === 'string' && existingRequestId.length > 0
        ? existingRequestId
        : randomUUID();

    // Extraction X-Tenant-ID : multi-tenant 3 niveaux (decision-002).
    // Sprint 5 remplacera par extraction JWT avec validation RBAC.
    const tenantIdHeader = req.headers['x-tenant-id'];
    const tenantId =
      typeof tenantIdHeader === 'string' && tenantIdHeader.length > 0
        ? tenantIdHeader
        : undefined;

    // Extraction correlation OpenTelemetry depuis le span actif.
    // Le span est actif si l'instrumentation HTTP OTel a deja instrumente
    // la requete (via auto-instrumentation startTelemetry dans main.ts).
    const span = trace.getActiveSpan();
    const spanCtx = span?.spanContext();

    const context: RequestContext = {
      request_id: requestId,
      ...(tenantId !== undefined ? { tenant_id: tenantId } : {}),
      ...(spanCtx !== undefined
        ? { trace_id: spanCtx.traceId, span_id: spanCtx.spanId }
        : {}),
    };

    // requestContextStorage.run() propage le store a toute la chaine async
    // SANS que les fonctions appelees aient besoin de passer le contexte
    // explicitement comme parametre.
    requestContextStorage.run(context, next);
  }
}
