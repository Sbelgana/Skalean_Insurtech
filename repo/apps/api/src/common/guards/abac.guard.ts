/**
 * AbacGuard -- Sprint 7 Tache 2.3.8.
 *
 * Guard ABAC orchestrant : load resource -> build AbacContext -> AbacService.
 *
 * Execute APRES PermissionGuard (chain).
 * Si @AbacResource + @RequirePermission sur l'endpoint :
 *   1. Lit metadata (resourceType + idExtractor + permissions).
 *   2. Extract resource id depuis la request.
 *   3. Load resource via ResourceLoaderService (cached).
 *   4. Build AbacContext (userId, userRole, tenantId, resource fields).
 *   5. AbacService.evaluate(permission, context) pour chaque perm requise.
 *   6. mode='all' : echec si une seule deny ; mode='any' : OK si au moins une.
 *
 * Audit log denied via Pino (loi 09-08 CNDP).
 *
 * super_admin_platform : wildcard short-circuit (laisse passer sans evaluer).
 *
 * Reference : B-07 Tache 2.3.8.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AbacService,
  AuthRole,
  type PermissionValue,
  RBAC_ERROR_CODES,
  TenantContextService,
} from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import {
  ABAC_RESOURCE_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/metadata-keys.js';
import type { AbacResourceMetadata } from '../decorators/abac-resource.decorator.js';
import type { PermissionRequirement } from '../decorators/require-permission.decorator.js';
import { ResourceLoaderService } from '../services/resource-loader.service.js';

@Injectable()
export class AbacGuard implements CanActivate {
  private readonly logger = new Logger(AbacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly abac: AbacService,
    private readonly loader: ResourceLoaderService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const handler = executionContext.getHandler();
    const classRef = executionContext.getClass();

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      handler,
      classRef,
    ]);
    if (isPublic) return true;

    const abacMeta = this.reflector.getAllAndOverride<AbacResourceMetadata | undefined>(
      ABAC_RESOURCE_KEY,
      [handler, classRef],
    );

    // Pas de @AbacResource -> bypass (PermissionGuard a deja gere RBAC pur).
    if (!abacMeta) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      REQUIRE_PERMISSIONS_KEY,
      [handler, classRef],
    );
    if (!requirement || requirement.permissions.length === 0) return true;

    const ctx = this.tenantContext.getCurrentContext();
    const userRole = ctx?.userRole;
    const userId = ctx?.userId;

    if (!userRole || !userId) {
      throw new ForbiddenException({
        code: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        message: 'User role and id required for ABAC evaluation',
      });
    }

    // super_admin_platform : wildcard short-circuit (deja gere par PermissionGuard
    // mais defense en profondeur ici).
    if (userRole === AuthRole.SuperAdminPlatform) return true;

    const request = executionContext.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      params?: Record<string, unknown>;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
    }>();

    const resourceId = abacMeta.idExtractor(request);
    if (!resourceId) {
      throw new ForbiddenException({
        code: RBAC_ERROR_CODES.ABAC_DENIED,
        message: 'Resource ID could not be extracted from request',
      });
    }

    const resource = await this.loader.load(abacMeta.resourceType, resourceId, ctx?.tenantId);
    if (!resource) {
      throw new NotFoundException({
        code: RBAC_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: `${abacMeta.resourceType} not found : ${resourceId}`,
      });
    }

    const baseContext = {
      userId,
      userRole,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      resourceType: abacMeta.resourceType,
      resourceId: resource.id,
      ...(resource.ownerId ? { resourceOwnerId: resource.ownerId } : {}),
      ...(resource.assigneeId ? { resourceAssigneeId: resource.assigneeId } : {}),
      ...(resource.status ? { resourceStatus: resource.status } : {}),
      ...(resource.createdAt ? { resourceCreatedAt: resource.createdAt } : {}),
      ...(resource.metadata ? { resourceMetadata: resource.metadata } : {}),
      now: new Date(),
    };

    const evaluations = await Promise.all(
      requirement.permissions.map((perm) => this.abac.evaluate(perm, baseContext)),
    );

    if (requirement.mode === 'all') {
      for (let i = 0; i < evaluations.length; i++) {
        const r = evaluations[i];
        const perm = requirement.permissions[i] as PermissionValue;
        if (!r) continue;
        // NO_POLICY_FOR_PERMISSION : la perm n'a pas de policy ABAC -> on
        // accepte (le RBAC pur via PermissionGuard a deja valide). C'est le
        // comportement "ABAC enrichit, ne bloque pas".
        if (!r.allowed && r.reason !== 'NO_POLICY_FOR_PERMISSION') {
          this.logDenied(request, classRef.name, handler.name, perm, r.reason);
          throw new ForbiddenException({
            code: RBAC_ERROR_CODES.ABAC_DENIED,
            message: `ABAC denied : ${r.reason ?? 'unknown'} on permission ${perm}`,
            policy: r.policy,
          });
        }
      }
    } else {
      // mode='any' : si au moins une perm est evaluable par ABAC ET allowed -> OK.
      // Si aucune n'a de policy : NO_POLICY -> OK (RBAC seul suffit).
      const allNoPolicy = evaluations.every((r) => r?.reason === 'NO_POLICY_FOR_PERMISSION');
      if (allNoPolicy) return true;

      const anyAllowed = evaluations.some((r) => r?.allowed);
      if (!anyAllowed) {
        const firstDeny = evaluations.find(
          (r) => !r?.allowed && r?.reason !== 'NO_POLICY_FOR_PERMISSION',
        );
        this.logDenied(
          request,
          classRef.name,
          handler.name,
          firstDeny?.permission,
          firstDeny?.reason,
        );
        throw new ForbiddenException({
          code: RBAC_ERROR_CODES.ABAC_DENIED,
          message: `ABAC denied : no permission allowed via ABAC`,
        });
      }
    }

    return true;
  }

  private logDenied(
    request: { method?: string; url?: string },
    controller: string,
    handler: string,
    permission: PermissionValue | undefined,
    reason: string | undefined,
  ): void {
    this.logger.warn(
      `abac_access_denied controller=${controller} handler=${handler} method=${request.method ?? '-'} path=${request.url ?? '-'} permission=${permission ?? '-'} reason=${reason ?? '-'}`,
    );
  }
}
