/**
 * Decorator class/method-level @AdminOnly() : enforce isSuperAdmin === true.
 *
 * Le TenantContextGuard rejette si !isSuperAdmin. Validation role specifique
 * (super_admin_platform vs analyst_support) deleguee au SuperAdminGuard Tache 2.2.10.
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import { SetMetadata } from '@nestjs/common';
import { ADMIN_ONLY_KEY } from './metadata-keys.js';

export const AdminOnly = (): ClassDecorator & MethodDecorator =>
  SetMetadata(ADMIN_ONLY_KEY, true);
