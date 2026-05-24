/**
 * AdminPermissionsController -- Sprint 7 Tache 2.3.11.
 *
 * Endpoints super admin pour introspection RBAC :
 *   GET /api/v1/admin/rbac/roles               -> liste 26 roles + meta
 *   GET /api/v1/admin/rbac/roles/:role         -> detail permissions + heritage
 *   GET /api/v1/admin/rbac/permissions          -> catalog 130 perms par module
 *   GET /api/v1/admin/rbac/permissions/:perm/roles -> inverse mapping
 *   POST /api/v1/admin/rbac/cache/invalidate    -> reset cache local (Sprint 7 simple)
 *
 * Protection :
 *   - @AdminOnly classe : TenantContextGuard verifie isSuperAdmin
 *   - SuperAdminGuard (Sprint 6) : platform-level + role IN platform roles
 *   - Pas d'endpoint write Sprint 7 (matrix code-as-config)
 *
 * Reference : B-07 Tache 2.3.11.
 */

import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ALL_AUTH_ROLES,
  ALL_PERMISSIONS,
  AuthRole,
  isValidPermission,
  type PermissionValue,
} from '@insurtech/auth';
import { AdminOnly } from '../../../common/decorators/admin-only.decorator.js';
import { SuperAdminOnly } from '../../../common/decorators/super-admin-only.decorator.js';
import { AdminPermissionsService } from '../services/admin-permissions.service.js';

@Controller('api/v1/admin/rbac')
@AdminOnly()
@SuperAdminOnly()
export class AdminPermissionsController {
  constructor(private readonly service: AdminPermissionsService) {}

  @Get('roles')
  listRoles() {
    const roles = this.service.listRoles();
    return {
      count: roles.length,
      roles,
    };
  }

  @Get('roles/:role')
  getRoleDetail(@Param('role') roleParam: string) {
    if (!ALL_AUTH_ROLES.includes(roleParam as AuthRole)) {
      throw new NotFoundException({
        code: 'RBAC_ROLE_NOT_FOUND',
        message: `Unknown role : ${roleParam}`,
      });
    }
    return this.service.getRoleDetail(roleParam as AuthRole);
  }

  @Get('permissions')
  getPermissions() {
    return this.service.getPermissionsCatalog();
  }

  @Get('permissions/:permission/roles')
  getRolesByPermission(@Param('permission') permission: string) {
    if (!isValidPermission(permission)) {
      throw new BadRequestException({
        code: 'RBAC_PERMISSION_NOT_FOUND',
        message: `Unknown permission : ${permission}`,
      });
    }
    const roles = this.service.getRolesByPermission(permission as PermissionValue);
    return {
      permission,
      rolesCount: roles.length,
      roles,
    };
  }

  /**
   * Reset le cache memoize in-process du RbacService. Operation idempotente.
   * Sprint 7.5b+ : etendre pour invalider PermissionCacheService Redis distribue.
   */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  invalidateCache() {
    const result = this.service.clearLocalCache();
    return {
      ...result,
      permissionsCount: ALL_PERMISSIONS.length,
      rolesCount: ALL_AUTH_ROLES.length,
    };
  }
}
