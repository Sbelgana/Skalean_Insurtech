/**
 * Decorator @TenantSettingsParam() : extract TenantSettings caches dans le contexte.
 *
 * Usage :
 *   async profile(@TenantSettingsParam() settings: TenantSettings) { ... }
 *
 * Retourne TenantSettings cachees par middleware (Tache 2.2.2). undefined si pas de tenant.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { type TenantSettings, tenantContextStorage } from '@insurtech/auth';

export const TenantSettingsParam = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): TenantSettings | undefined => {
    return tenantContextStorage.getStore()?.tenantSettings;
  },
);
