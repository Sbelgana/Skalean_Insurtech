/**
 * Decorator @CrossTenantAuthId() : extract crossTenantAuthorizationId.
 *
 * Sprint 6 prepare le decorator. Sprint 26 implementera runtime usage avec
 * header `x-cross-tenant-auth-id` lu par middleware enrichi.
 *
 * Reference : Sprint 6 / Tache 2.2.3 (preparation Sprint 26).
 */

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { tenantContextStorage } from '@insurtech/auth';

export const CrossTenantAuthId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | undefined => {
    return tenantContextStorage.getStore()?.crossTenantAuthorizationId;
  },
);
