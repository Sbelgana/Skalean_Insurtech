/**
 * Decorator @AssureUserId() : extract assureUserId pour routes /api/v1/assure/*.
 *
 * Usage :
 *   @Get()
 *   async listMine(@AssureUserId() assureUserId: string, @TenantId() tenantId: string) { ... }
 *
 * Sur routes /api/v1/assure/*, le middleware Tache 2.2.2 set assureUserId = userId.
 * Sur autres routes, retourne undefined.
 *
 * Reference : Sprint 6 / Tache 2.2.3 (utilise Sprint 19+).
 */

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { tenantContextStorage } from '@insurtech/auth';

export const AssureUserId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string | undefined => {
    return tenantContextStorage.getStore()?.assureUserId;
  },
);
