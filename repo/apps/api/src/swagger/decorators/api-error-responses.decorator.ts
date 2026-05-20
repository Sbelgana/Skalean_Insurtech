/**
 * @ApiErrorResponses({ codes: ['NOT_FOUND', 'CONFLICT'] }) decorator.
 *
 * Applique rapidement les decorators Swagger pour les reponses erreur
 * attendues par un controller, sans dupliquer manuellement les schemas.
 *
 * Usage :
 *   @ApiErrorResponses({ codes: ['NOT_FOUND', 'CONFLICT'] })
 *   @Get(':id')
 *   findOne() { ... }
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  ApiServiceUnavailableResponse,
  ApiGoneResponse,
} from '@nestjs/swagger';
import { type ErrorCode, ErrorCodes } from '../../exceptions/error-codes';

export interface ApiErrorResponsesOptions {
  codes: ErrorCode[];
}

/** Schema generique d'une reponse erreur. */
function errorSchemaTemplate(code: string, status: number, message: string) {
  return {
    description: `${code} (HTTP ${status})`,
    schema: {
      type: 'object' as const,
      required: ['success', 'error', 'meta'],
      properties: {
        success: { type: 'boolean' as const, example: false },
        error: {
          type: 'object' as const,
          required: ['statusCode', 'code', 'message'],
          properties: {
            statusCode: { type: 'integer' as const, example: status },
            code: { type: 'string' as const, example: code },
            message: { type: 'string' as const, example: message },
            details: { type: 'array' as const, items: { type: 'object' as const } },
          },
        },
        meta: {
          type: 'object' as const,
          properties: {
            timestamp: { type: 'string' as const, format: 'date-time' },
            request_id: { type: 'string' as const },
          },
        },
      },
    },
  };
}

type AnyDecorator = ClassDecorator | MethodDecorator | PropertyDecorator;

/**
 * Applique les decorators Swagger pour les codes d'erreur specifies.
 */
export const ApiErrorResponses = (options: ApiErrorResponsesOptions) => {
  const decorators: AnyDecorator[] = [];

  for (const code of options.codes) {
    const errorDef = ErrorCodes[code];
    if (!errorDef) continue;

    const schema = errorSchemaTemplate(code, errorDef.status, errorDef.message);

    if (errorDef.status === 400) {
      decorators.push(ApiBadRequestResponse(schema));
    } else if (errorDef.status === 401) {
      decorators.push(ApiUnauthorizedResponse(schema));
    } else if (errorDef.status === 403) {
      decorators.push(ApiForbiddenResponse(schema));
    } else if (errorDef.status === 404) {
      decorators.push(ApiNotFoundResponse(schema));
    } else if (errorDef.status === 409) {
      decorators.push(ApiConflictResponse(schema));
    } else if (errorDef.status === 410) {
      decorators.push(ApiGoneResponse(schema));
    } else if (errorDef.status === 429) {
      decorators.push(ApiTooManyRequestsResponse(schema));
    } else if (errorDef.status === 503) {
      decorators.push(ApiServiceUnavailableResponse(schema));
    } else if (errorDef.status >= 500) {
      decorators.push(ApiInternalServerErrorResponse(schema));
    }
  }

  return applyDecorators(...(decorators as Array<ClassDecorator | MethodDecorator | PropertyDecorator>));
};
