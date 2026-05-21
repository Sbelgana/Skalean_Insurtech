/**
 * Decorator class/method-level @RequireTenant() : enforce tenantId valide.
 *
 * Le TenantContextGuard (canActivate) lit cette metadata via Reflector et reject
 * si tenantId est undefined.
 *
 * Usage :
 *   @RequireTenant()
 *   @Controller('contacts')
 *   export class ContactsController { ... }
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import { SetMetadata } from '@nestjs/common';
import { REQUIRE_TENANT_KEY } from './metadata-keys.js';

export const RequireTenant = (): ClassDecorator & MethodDecorator =>
  SetMetadata(REQUIRE_TENANT_KEY, true);
