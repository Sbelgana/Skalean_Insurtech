/**
 * Decorator @CurrentTenant() : extract TenantContext complet (11 champs readonly).
 *
 * Usage :
 *   async details(@CurrentTenant() ctx: TenantContext) {
 *     const userId = ctx.userId;
 *     const settings = ctx.tenantSettings;
 *   }
 *
 * Retourne TenantContext complet, undefined si pas de contexte (test/misconfigured).
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { type TenantContext, tenantContextStorage } from '@insurtech/auth';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): TenantContext | undefined => {
    return tenantContextStorage.getStore();
  },
);
