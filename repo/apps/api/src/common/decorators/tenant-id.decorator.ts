/**
 * Decorator @TenantId() : extract tenantId depuis AsyncLocalStorage.
 *
 * Usage :
 *   async list(@TenantId() tenantId: string) { ... }
 *
 * Retourne tenantId si present, undefined sinon (routes admin/public).
 * Pour assertion non-undefined : combiner avec @RequireTenant() class-level.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { tenantContextStorage } from '@insurtech/auth';

export const TenantId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | undefined => {
    return tenantContextStorage.getStore()?.tenantId;
  },
);
