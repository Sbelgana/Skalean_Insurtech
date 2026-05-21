/**
 * @SkipTenantTransaction() : opt-out de l'interceptor TenantTransactionInterceptor.
 *
 * A appliquer UNIQUEMENT aux endpoints qui ne font pas d'I/O DB :
 *   - /healthz, /readyz (Sprint 3)
 *   - /docs/* (Swagger UI assets)
 *   - /metrics (Prometheus)
 *
 * Discipline : appliquer ce decorator sans justification documentee est interdit.
 *
 * Reference : Sprint 6 / Tache 2.2.4.
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_TRANSACTION_KEY = 'skip-tenant-transaction';

export const SkipTenantTransaction = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_TENANT_TRANSACTION_KEY, true);
