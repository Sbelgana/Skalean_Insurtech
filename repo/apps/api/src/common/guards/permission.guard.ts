/**
 * PermissionGuard -- Sprint 7 Tache 2.3.5.
 *
 * Guard granulaire qui consume RbacService pour evaluer si user a la
 * permission demandee. Execute APRES JwtAuthGuard + TenantContextGuard (chain).
 *
 * Compatibilite Sprint 6 :
 *   - Public route -> bypass
 *   - Pas de @RequirePermission* -> bypass (laisse passer)
 *   - super_admin_platform -> wildcard via RbacService
 *   - TenantContextGuard a peuple ctx.userRole (sinon NO_USER_CONTEXT)
 *
 * Audit log denied via Pino (loi 09-08 CNDP). Sprint 7 Tache 2.3.9 ajoutera
 * RbacAuditService dedie (INSERT audit_log + Kafka event).
 *
 * Reference : B-07 Tache 2.3.5.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBAC_ERROR_CODES, RbacService, TenantContextService } from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/metadata-keys.js';
import type { PermissionRequirement } from '../decorators/require-permission.decorator.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly rbac: RbacService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const handler = executionContext.getHandler();
    const classRef = executionContext.getClass();

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      handler,
      classRef,
    ]);
    if (isPublic) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      REQUIRE_PERMISSIONS_KEY,
      [handler, classRef],
    );

    if (!requirement || requirement.permissions.length === 0) return true;

    const ctx = this.tenantContext.getCurrentContext();
    const userRole = ctx?.userRole;
    const request = executionContext.switchToHttp().getRequest<{
      method?: string;
      url?: string;
    }>();

    if (!userRole) {
      this.logDenied(
        request,
        classRef.name,
        handler.name,
        'no_user_role',
        undefined,
        requirement,
      );
      throw new ForbiddenException({
        code: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        message: 'User role context required',
      });
    }

    const result =
      requirement.mode === 'all'
        ? this.rbac.canAccessAll(userRole, requirement.permissions)
        : this.rbac.canAccessAny(userRole, requirement.permissions);

    if (!result.allowed) {
      this.logDenied(
        request,
        classRef.name,
        handler.name,
        result.reason ?? 'permission_denied',
        userRole,
        requirement,
      );
      throw new ForbiddenException({
        code: result.reason ?? RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
        message: `Permission denied : mode=${requirement.mode} required=[${requirement.permissions.join(',')}]`,
        ...(result.permission ? { permission: result.permission } : {}),
      });
    }

    return true;
  }

  private logDenied(
    request: { method?: string; url?: string },
    controller: string,
    handler: string,
    reason: string,
    userRole: string | undefined,
    requirement: PermissionRequirement,
  ): void {
    this.logger.warn(
      `permission_access_denied controller=${controller} handler=${handler} method=${request.method ?? '-'} path=${request.url ?? '-'} role=${userRole ?? '-'} mode=${requirement.mode} required=[${requirement.permissions.join(',')}] reason=${reason}`,
    );
  }
}
