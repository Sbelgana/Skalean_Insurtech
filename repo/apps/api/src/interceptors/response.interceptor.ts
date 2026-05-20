/**
 * ResponseInterceptor -- interceptor global NestJS qui normalise le format
 * de toutes les reponses API de Skalean InsurTech v2.2.
 *
 * Format cible des reponses succes :
 * {
 *   "success": true,
 *   "data": <payload du handler>,
 *   "meta": {
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "version": "2.2.0",
 *     "request_id": "uuid-v4",
 *     "duration_ms": 42
 *   }
 * }
 *
 * Regles :
 *   - Applique a TOUTES les reponses succes (2xx).
 *   - Si la reponse est deja enveloppee (propriete `success` presente),
 *     elle est retournee telle quelle (evite double-wrapping).
 *   - request_id provient du RequestContext AsyncLocalStorage (Tache 1.3.4).
 *   - duration_ms = temps entre debut intercept et emission de la reponse.
 *   - Les reponses erreur (4xx, 5xx) sont gerees par le ExceptionFilter (Tache 1.3.8).
 *
 * Registration : `app.useGlobalInterceptors(new ResponseInterceptor())` dans main.ts.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.7 (Sprint 3 / Phase 1).
 */
import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestContext } from '../request-context/request-context';

/** Metadonnees incluses dans chaque reponse API. */
export interface ApiResponseMeta {
  /** Horodatage ISO 8601 de la reponse. */
  timestamp: string;
  /** Version de l'API (APP_VERSION env). */
  version: string;
  /** Identifiant unique de la requete (RequestContext). */
  request_id?: string;
  /** Duree de traitement en millisecondes. */
  duration_ms: number;
}

/** Enveloppe standardisee des reponses API succes. */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: ApiResponseMeta;
}

/** Union type des reponses API (succes ou deja-enveloppee). */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | T;

/**
 * Verifie si la valeur est deja une reponse enveloppee (succes ou erreur).
 * Evite le double-wrapping si un handler retourne manuellement la structure.
 */
function isAlreadyWrapped(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as Record<string, unknown>)['success'] === 'boolean'
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const startTime = Date.now();
    const requestId = getRequestContext()?.request_id;
    const version = process.env['APP_VERSION'] ?? '2.2.0';

    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        // Si deja enveloppe, ne pas re-envelopper.
        if (isAlreadyWrapped(data)) {
          return data as ApiResponse<T>;
        }

        const meta: ApiResponseMeta = {
          timestamp: new Date().toISOString(),
          version,
          request_id: requestId,
          duration_ms: Date.now() - startTime,
        };

        const response: ApiSuccessResponse<T> = {
          success: true,
          data,
          meta,
        };

        return response;
      }),
    );
  }
}
