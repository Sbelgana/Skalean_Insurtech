/**
 * @RequirePermission / @RequireAnyPermission / @RequireAllPermissions decorators
 * -- Sprint 7 Tache 2.3.5.
 *
 * Usage :
 *   @RequirePermission(Permission.CRM_CONTACTS_CREATE)
 *   @Post('/contacts')
 *
 *   @RequireAnyPermission(Permission.A, Permission.B)
 *   @Get('/can-do-either')
 *
 *   @RequireAllPermissions(Permission.A, Permission.B)
 *   @Post('/needs-both')
 *
 * Compose avec PermissionGuard (registered global). super_admin_platform
 * passe via wildcard short-circuit.
 *
 * Reference : B-07 Tache 2.3.5.
 */

import { SetMetadata } from '@nestjs/common';
import type { PermissionValue } from '@insurtech/auth';
import { REQUIRE_PERMISSIONS_KEY } from './metadata-keys.js';

export type PermissionRequirementMode = 'any' | 'all';

export interface PermissionRequirement {
  readonly permissions: readonly PermissionValue[];
  readonly mode: PermissionRequirementMode;
}

/** Single permission required. */
export const RequirePermission = (
  permission: PermissionValue,
): MethodDecorator & ClassDecorator =>
  SetMetadata<string, PermissionRequirement>(REQUIRE_PERMISSIONS_KEY, {
    permissions: [permission],
    mode: 'all',
  });

/** Any of the listed permissions (OR logic). */
export const RequireAnyPermission = (
  ...permissions: readonly PermissionValue[]
): MethodDecorator & ClassDecorator =>
  SetMetadata<string, PermissionRequirement>(REQUIRE_PERMISSIONS_KEY, {
    permissions,
    mode: 'any',
  });

/** All of the listed permissions (AND logic). */
export const RequireAllPermissions = (
  ...permissions: readonly PermissionValue[]
): MethodDecorator & ClassDecorator =>
  SetMetadata<string, PermissionRequirement>(REQUIRE_PERMISSIONS_KEY, {
    permissions,
    mode: 'all',
  });
