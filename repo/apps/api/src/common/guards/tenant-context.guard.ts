/**
 * TenantContextGuard -- Defense en profondeur multi-tenant.
 *
 * Execute APRES JwtAuthGuard (Sprint 5) et APRES TenantContextMiddleware (Tache 2.2.2).
 * Verifie :
 *   1. Si @Public() actif (IS_PUBLIC_KEY Sprint 3) -> skip toutes verifications.
 *   2. Si @AdminOnly() actif -> exiger isSuperAdmin === true.
 *   3. Si @RequireTenant() actif -> exiger tenantId non-undefined.
 *   4. Sinon : skip (autorise par defaut, le middleware a deja valide).
 *
 * Discipline : verification redondante avec middleware INTENTIONNELLE
 * (tests integration peuvent bypass middleware, refactoring peut casser silencieux).
 *
 * Reference : Sprint 6 / Tache 2.2.3.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { ADMIN_ONLY_KEY, REQUIRE_TENANT_KEY } from '../decorators/metadata-keys.js';

@Injectable()
export class TenantContextGuard implements CanActivate {
  private readonly logger = new Logger(TenantContextGuard.name);

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

    const ctx = this.tenantContext.getCurrentContext();
    if (!ctx) {
      this.logger.error(
        `tenant_context_missing_in_guard handler=${handler.name} controller=${classRef.name}`,
      );
      throw new InternalServerErrorException({
        code: 'TENANT_CONTEXT_MISSING',
        message: 'Tenant context not initialized. Middleware misconfigured.',
      });
    }

    const isAdminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ONLY_KEY,
      [handler, classRef],
    );
    if (isAdminOnly) {
      if (!ctx.isSuperAdmin) {
        this.logger.warn(
          `admin_only_endpoint_access_denied handler=${handler.name} user=${ctx.userId} super_admin=${ctx.isSuperAdmin}`,
        );
        throw new ForbiddenException({
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'This endpoint is restricted to super admins',
        });
      }
      return true;
    }

    const requiresTenant = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRE_TENANT_KEY,
      [handler, classRef],
    );
    if (requiresTenant && !ctx.tenantId) {
      this.logger.warn(
        `require_tenant_endpoint_no_tenant_id handler=${handler.name} user=${ctx.userId}`,
      );
      throw new ForbiddenException({
        code: 'TENANT_ID_REQUIRED',
        message: 'This endpoint requires a tenant context (x-tenant-id header)',
      });
    }

    return true;
  }
}
