/**
 * AllExceptionsFilter -- filtre global NestJS qui intercepte toutes les
 * exceptions et retourne une reponse d'erreur standardisee.
 *
 * Format cible des reponses erreur :
 * {
 *   "success": false,
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Ressource introuvable",
 *     "statusCode": 404,
 *     "details": [...] // uniquement hors production
 *   },
 *   "meta": {
 *     "timestamp": "2024-01-15T10:30:00.000Z",
 *     "request_id": "uuid-v4"
 *   }
 * }
 *
 * Regles :
 *   - HttpException NestJS : extrait statut + message depuis getResponse().
 *   - ZodValidationErrorResponse (Tache 1.3.6) : extrait errors[].
 *   - Erreurs inconnues : code INTERNAL_SERVER_ERROR, statut 500.
 *   - Production : ne pas exposer le stack ou le message d'erreur brut.
 *   - PII : les messages d'erreur bruts ne sont JAMAIS exposes au client.
 *             Le log complet (avec stack) va vers Pino (redact + SIEM).
 *   - Log : chaque erreur 5xx est loggee ERROR, 4xx loggee WARN.
 *
 * Registration : `app.useGlobalFilters(new AllExceptionsFilter())` dans main.ts.
 *
 * Reference : decision-006 (no-emoji) + CNDP loi 09-08 (no PII in responses).
 * Tache : 1.3.8 (Sprint 3 / Phase 1).
 */
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { getRequestContext } from '../request-context/request-context';
import type { ZodValidationErrorResponse } from '../pipes/zod-validation.pipe';
import { sentryCaptureException } from '../sentry/sentry.config';

/** Corps de reponse erreur standardise. */
export interface ApiErrorBody {
  statusCode: number;
  /** Code d'erreur uppercase snake_case (ex: NOT_FOUND, VALIDATION_ERROR). */
  code: string;
  /** Message humain sans PII -- safe a exposer au client. */
  message: string;
  /** Details de validation Zod (uniquement pour 400 validation). */
  details?: Array<{ path: string; message: string; code: string }>;
}

/** Reponse erreur complete retournee par le filtre. */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  meta: {
    timestamp: string;
    request_id?: string;
  };
}

/** Map des codes HTTP vers les codes d'erreur uppercase. */
const HTTP_STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

/**
 * Derive le code d'erreur depuis le statut HTTP.
 */
function getErrorCode(statusCode: number): string {
  return HTTP_STATUS_CODE_MAP[statusCode] ?? `HTTP_${statusCode}`;
}

/**
 * Verifie si le corps de reponse est une ZodValidationErrorResponse.
 */
function isZodValidationErrorResponse(
  body: unknown,
): body is ZodValidationErrorResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as Record<string, unknown>)['message'] === 'Validation failed' &&
    Array.isArray((body as Record<string, unknown>)['errors'])
  );
}

/**
 * Extrait un message safe depuis la reponse HttpException.
 * Ne jamais exposer de messages d'erreur bruts (PII potentiel).
 */
function extractSafeMessage(
  httpResponse: string | Record<string, unknown>,
  statusCode: number,
  isProduction: boolean,
): string {
  if (isProduction) {
    // En production : messages generiques uniquement.
    return statusCode < 500
      ? 'La requete est invalide ou non autorisee.'
      : 'Une erreur interne est survenue. Veuillez reessayer.';
  }

  if (typeof httpResponse === 'string') {
    return httpResponse;
  }

  const msg = (httpResponse as Record<string, unknown>)['message'];
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.join(', ');
  return getErrorCode(statusCode);
}

/**
 * AllExceptionsFilter -- filtre global qui capture toutes les exceptions.
 *
 * @Catch() sans argument = capture TOUTES les exceptions (HttpException + autres).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction =
    process.env['NODE_ENV'] === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const requestCtx = getRequestContext();
    const timestamp = new Date().toISOString();

    let statusCode: number;
    let errorBody: ApiErrorBody;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const httpResponse = exception.getResponse() as
        | string
        | Record<string, unknown>;

      // Cas ZodValidationErrorResponse (Tache 1.3.6) : 400 avec details Zod.
      if (isZodValidationErrorResponse(httpResponse)) {
        errorBody = {
          statusCode,
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: httpResponse.errors,
        };
      } else {
        errorBody = {
          statusCode,
          code: getErrorCode(statusCode),
          message: extractSafeMessage(httpResponse, statusCode, this.isProduction),
        };
      }
    } else {
      // Exception non-HTTP : erreur interne.
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorBody = {
        statusCode,
        code: 'INTERNAL_SERVER_ERROR',
        message: this.isProduction
          ? 'Une erreur interne est survenue. Veuillez reessayer.'
          : (exception instanceof Error
              ? exception.message
              : String(exception)),
      };
    }

    // Logging : 5xx -> ERROR, 4xx -> WARN.
    // Stack et details ne sont loggues que cote serveur (pas dans la reponse).
    const logPayload = {
      statusCode,
      request_id: requestCtx?.request_id,
      tenant_id: requestCtx?.tenant_id,
      method: request?.method,
      url: request?.url,
      ...(exception instanceof Error
        ? { errorMessage: exception.message, stack: exception.stack }
        : { exception: String(exception) }),
    };

    if (statusCode >= 500) {
      this.logger.error(logPayload, `[AllExceptionsFilter] ${errorBody.code}`);
      // Capture Sentry pour les erreurs 5xx (no-op si SENTRY_DSN absent).
      // Tache 1.3.12.
      sentryCaptureException(exception, {
        tenantId: requestCtx?.tenant_id,
        userId: requestCtx?.user_id,
        requestId: requestCtx?.request_id,
      });
    } else {
      this.logger.warn(logPayload, `[AllExceptionsFilter] ${errorBody.code}`);
    }

    const response: ApiErrorResponse = {
      success: false,
      error: errorBody,
      meta: {
        timestamp,
        request_id: requestCtx?.request_id,
      },
    };

    // Multi-shape response handling (Sprint 8 Task 8.14b Session C) :
    //   1. FastifyReply.code(n).send(body) -- canonical Fastify route handler.
    //   2. FastifyReply.status(n).send(body) -- Express-style alias (older versions).
    //   3. Node ServerResponse (raw) -- when inject()-simulated requests
    //      surface the underlying HTTP res. Pattern : statusCode + setHeader + end.
    // The original filter was Express-first (`reply.status`) and never ported
    // to Fastify ; this dual-API approach unblocks both production (Fastify
    // canonical) and in-process E2E (`app.inject()` raw ServerResponse).
    const replyAny = reply as unknown as {
      code?: (s: number) => { send: (b: unknown) => unknown };
      status?: (s: number) => { send: (b: unknown) => unknown };
      send?: (b: unknown) => unknown;
      setHeader?: (name: string, value: string) => void;
      end?: (chunk?: unknown) => void;
      statusCode?: number;
    };
    if (typeof replyAny.code === 'function') {
      void replyAny.code(statusCode).send(response);
    } else if (typeof replyAny.status === 'function') {
      void replyAny.status(statusCode).send(response);
    } else if (
      typeof replyAny.end === 'function' &&
      typeof replyAny.setHeader === 'function'
    ) {
      // Raw Node ServerResponse (inject() simulated path).
      replyAny.statusCode = statusCode;
      replyAny.setHeader('content-type', 'application/json; charset=utf-8');
      replyAny.end(JSON.stringify(response));
    } else if (typeof replyAny.send === 'function') {
      replyAny.statusCode = statusCode;
      void replyAny.send(response);
    }
  }
}
