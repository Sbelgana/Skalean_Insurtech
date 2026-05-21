/**
 * SuperAdminGuard -- defense fine-grained pour /api/v1/admin/*.
 *
 * Execute APRES TenantContextGuard (Tache 2.2.3 verifie isSuperAdmin basique).
 * Cette guard ajoute :
 *   1. Verification ctx.userRole IN (super_admin_platform, analyst_support)
 *   2. Verification ctx.tenantId === undefined (platform-level, anti escalade)
 *   3. Distinction read-only analyst_support vs full super_admin_platform :
 *      - GET/HEAD/OPTIONS : analyst_support autorise
 *      - POST/PATCH/PUT/DELETE : seul super_admin_platform passe
 *   4. @SuperAdminWrite() : enforce super_admin_platform meme sur GET
 *
 * Audit obligatoire (loi 09-08 CNDP) :
 *   denied path -> super_admin_access_denied log Pino structure
 *   granted path -> delegue a SuperAdminAuditInterceptor (Tache 2.2.10)
 *
 * Composition decorators :
 *   @SuperAdminOnly  -- class : route /admin/*
 *   @SuperAdminWrite -- method : enforce write super_admin_platform
 *   @AnalystAllowed  -- method : explicit allow analyst (auto sur GET)
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRole, TenantContextService } from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import {
  ADMIN_ONLY_KEY,
  SUPER_ADMIN_ONLY_KEY,
  SUPER_ADMIN_WRITE_KEY,
} from '../decorators/metadata-keys.js';

const PLATFORM_ROLES: ReadonlyArray<AuthRole> = [
  AuthRole.SuperAdminPlatform,
  AuthRole.AnalystSupport,
];

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const SUPER_ADMIN_ERROR_CODES = {
  PLATFORM_ROLE_REQUIRED: 'SUPER_ADMIN_PLATFORM_ROLE_REQUIRED',
  PLATFORM_LEVEL_REQUIRED: 'SUPER_ADMIN_PLATFORM_LEVEL_REQUIRED',
  ANALYST_READ_ONLY: 'ANALYST_READ_ONLY',
  WRITE_REQUIRES_SUPER_ADMIN: 'WRITE_REQUIRES_SUPER_ADMIN_PLATFORM',
  ACCESS_DENIED: 'SUPER_ADMIN_ACCESS_DENIED',
} as const;

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly logger = new Logger(SuperAdminGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const handler = executionContext.getHandler();
    const classRef = executionContext.getClass();

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [handler, classRef],
    );
    if (isPublic) return true;

    // Skip si route ne demande pas explicitement admin/super-admin.
    const isAdminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ONLY_KEY,
      [handler, classRef],
    );
    const isSuperAdminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      SUPER_ADMIN_ONLY_KEY,
      [handler, classRef],
    );
    if (!isAdminOnly && !isSuperAdminOnly) {
      return true;
    }

    const ctx = this.tenantContext.getCurrentContext();
    const request = executionContext.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      headers?: Record<string, unknown>;
    }>();
    const method = request.method ?? 'GET';

    if (!ctx || !ctx.isSuperAdmin) {
      this.logAccessDenied(request, ctx, classRef.name, handler.name, 'context_missing_or_not_super_admin');
      throw new ForbiddenException({
        code: SUPER_ADMIN_ERROR_CODES.ACCESS_DENIED,
        message: 'Super admin context required',
      });
    }

    // Verifier platform-level (tenantId undefined).
    if (ctx.tenantId !== undefined) {
      this.logAccessDenied(request, ctx, classRef.name, handler.name, 'tenant_scoped_admin_rejected');
      throw new ForbiddenException({
        code: SUPER_ADMIN_ERROR_CODES.PLATFORM_LEVEL_REQUIRED,
        message: 'Super admin must be platform-level (tenant_id must be null)',
      });
    }

    // Verifier role est platform (super_admin_platform OR analyst_support).
    const role = ctx.userRole;
    if (!role || !PLATFORM_ROLES.includes(role)) {
      this.logAccessDenied(request, ctx, classRef.name, handler.name, 'role_not_platform');
      throw new ForbiddenException({
        code: SUPER_ADMIN_ERROR_CODES.PLATFORM_ROLE_REQUIRED,
        message: 'Role must be super_admin_platform or analyst_support',
      });
    }

    // @SuperAdminWrite : seul super_admin_platform passe.
    const requiresWriteRole = this.reflector.getAllAndOverride<boolean | undefined>(
      SUPER_ADMIN_WRITE_KEY,
      [handler, classRef],
    );
    if (requiresWriteRole && role !== AuthRole.SuperAdminPlatform) {
      this.logAccessDenied(request, ctx, classRef.name, handler.name, 'write_requires_super_admin');
      throw new ForbiddenException({
        code: SUPER_ADMIN_ERROR_CODES.WRITE_REQUIRES_SUPER_ADMIN,
        message: 'This endpoint requires super_admin_platform (analyst denied)',
      });
    }

    // analyst_support : read-only par defaut (GET/HEAD/OPTIONS), mutations bloquees.
    if (role === AuthRole.AnalystSupport && MUTATION_METHODS.has(method)) {
      this.logAccessDenied(request, ctx, classRef.name, handler.name, 'analyst_mutation_blocked');
      throw new ForbiddenException({
        code: SUPER_ADMIN_ERROR_CODES.ANALYST_READ_ONLY,
        message: 'analyst_support has read-only access (GET/HEAD/OPTIONS only)',
      });
    }

    return true;
  }

  private logAccessDenied(
    request: { method?: string; url?: string; ip?: string; headers?: Record<string, unknown> },
    ctx: ReturnType<TenantContextService['getCurrentContext']>,
    controller: string,
    handler: string,
    reason: string,
  ): void {
    this.logger.warn(
      `super_admin_access_denied controller=${controller} handler=${handler} method=${request.method ?? '-'} path=${request.url ?? '-'} user=${ctx?.userId ?? '-'} role=${ctx?.userRole ?? '-'} tenant=${ctx?.tenantId ?? '-'} ip=${request.ip ?? '-'} reason=${reason}`,
    );
  }
}
