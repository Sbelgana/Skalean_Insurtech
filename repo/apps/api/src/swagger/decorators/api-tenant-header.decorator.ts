/**
 * Decorators Swagger pour headers tenant + idempotency + trace.
 *
 * @ApiTenantHeader()    -- x-tenant-id (required par defaut)
 * @ApiIdempotencyKeyHeader() -- Idempotency-Key (optionnel)
 * @ApiTraceIdHeader()   -- x-trace-id (response header, optionnel)
 *
 * Reference : decision-006.
 * Tache : 1.3.9 (Sprint 3 / Phase 1).
 */
import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/**
 * Documente le header x-tenant-id dans Swagger.
 * Multi-tenant 3 niveaux (decision-002).
 */
export const ApiTenantHeader = (required = true) =>
  applyDecorators(
    ApiHeader({
      name: 'x-tenant-id',
      description:
        'Tenant UUID v4. Multi-tenant 3 niveaux. Sprint 6 valide existence.',
      required,
      schema: { type: 'string', format: 'uuid' },
    }),
  );

/**
 * Documente le header Idempotency-Key dans Swagger.
 * TTL 24h Redis. Protege les mutations contre les doublons.
 */
export const ApiIdempotencyKeyHeader = () =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      description: 'UUID v4 pour idempotence des mutations. TTL 24h Redis.',
      required: false,
      schema: { type: 'string', format: 'uuid' },
    }),
  );

/**
 * Documente le header x-trace-id dans Swagger (response header).
 * Correlation OTEL Tempo Sprint 35.
 */
export const ApiTraceIdHeader = () =>
  applyDecorators(
    ApiHeader({
      name: 'x-trace-id',
      description: 'OTEL trace_id (response header). Correlation Tempo Sprint 35.',
      required: false,
      schema: { type: 'string' },
    }),
  );
