/**
 * @SuperAdminOnly() : class/method decorator pour routes /api/v1/admin/*.
 *
 * Enforce par SuperAdminGuard (Tache 2.2.10) :
 *   - ctx.userRole IN (super_admin_platform, analyst_support)
 *   - ctx.tenantId === undefined (platform-level uniquement, anti escalade)
 *   - audit super_admin_access_granted/denied publie sur chaque call
 *
 * Combine avec @AnalystAllowed (per-route) ou @SuperAdminWrite (write only).
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import { SetMetadata } from '@nestjs/common';
import { SUPER_ADMIN_ONLY_KEY } from './metadata-keys.js';

export const SuperAdminOnly = (): ClassDecorator & MethodDecorator =>
  SetMetadata(SUPER_ADMIN_ONLY_KEY, true);
