/**
 * @Role decorator -- Sprint 7 Tache 2.3.4.
 *
 * Exige un role specifique (ou OR sur plusieurs) sur une route.
 *
 * Usage :
 *   @Role(AuthRole.BrokerAdmin)
 *   @Get('/broker/admin-only')
 *
 *   @Role(AuthRole.BrokerAdmin, AuthRole.GarageAdmin)
 *   @Get('/admin-multi-tenant')
 *
 * Compose avec RoleGuard (registered global ou via @UseGuards).
 * super_admin_platform passe TOUJOURS via wildcard logic dans RoleGuard.
 *
 * Reference : B-07 Tache 2.3.4.
 */

import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from '@insurtech/auth';
import { ROLE_KEY } from './metadata-keys.js';

/**
 * Decorator @Role(role | ...roles) : accepte 1 ou plusieurs roles (OR logic).
 * Class-level ou method-level.
 */
export const Role = (...roles: readonly AuthRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLE_KEY, roles);
