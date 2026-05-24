/**
 * RoleGuard -- Sprint 7 Tache 2.3.4.
 *
 * Force un role specifique sur endpoint via @Role(role[]) ou @MinRole(role).
 * Execute APRES TenantContextGuard (Sprint 6) qui peuple ctx.userRole.
 *
 * Logique :
 *   1. Route publique (@Public) -> bypass.
 *   2. Aucun decorator @Role/@MinRole -> bypass (laisse passer pour autres guards).
 *   3. super_admin_platform -> wildcard OK (toute exigence satisfaite).
 *   4. @Role(roles[]) : OR logic, accept si ctx.userRole IN roles.
 *   5. @MinRole(target) : accept si ctx.userRole === target OU ancestor de target.
 *   6. Si plusieurs decorators (rare) : AND logic entre @Role et @MinRole.
 *   7. Audit log denied via Pino (loi 09-08 CNDP).
 *
 * Ancetres precomputes : a partir du RoleHierarchy DAG (relation parent -> enfants),
 * on calcule reverse map enfant -> ancetres au constructor. O(1) lookup runtime.
 *
 * Reference : B-07 Tache 2.3.4.
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthRole,
  RBAC_ERROR_CODES,
  RoleHierarchy,
  TenantContextService,
} from '@insurtech/auth';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js';
import { MIN_ROLE_KEY, ROLE_KEY } from '../decorators/metadata-keys.js';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  /** Reverse map enfant -> ancetres (transitive). Calculee au constructor. */
  private readonly ancestorsOf: ReadonlyMap<AuthRole, ReadonlySet<AuthRole>>;

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {
    this.ancestorsOf = this.computeAncestors();
  }

  canActivate(executionContext: ExecutionContext): boolean {
    const handler = executionContext.getHandler();
    const classRef = executionContext.getClass();

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      handler,
      classRef,
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<readonly AuthRole[] | undefined>(
      ROLE_KEY,
      [handler, classRef],
    );
    const minRole = this.reflector.getAllAndOverride<AuthRole | undefined>(MIN_ROLE_KEY, [
      handler,
      classRef,
    ]);

    // Pas de decorator -> laisse passer (les autres guards prennent le relais).
    if (!requiredRoles && !minRole) return true;

    const ctx = this.tenantContext.getCurrentContext();
    const userRole = ctx?.userRole;
    const request = executionContext.switchToHttp().getRequest<{
      method?: string;
      url?: string;
    }>();

    if (!userRole) {
      this.logDenied(request, classRef.name, handler.name, 'no_user_role', undefined);
      throw new ForbiddenException({
        code: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        message: 'User role context required',
      });
    }

    // super_admin_platform : wildcard OK pour toute exigence.
    if (userRole === AuthRole.SuperAdminPlatform) return true;

    // @Role : OR logic.
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(userRole)) {
        this.logDenied(request, classRef.name, handler.name, 'role_not_in_required', userRole);
        throw new ForbiddenException({
          code: RBAC_ERROR_CODES.ROLE_REQUIRED,
          message: `One of roles [${requiredRoles.join(',')}] required, got '${userRole}'`,
        });
      }
    }

    // @MinRole : user role IN ancestors(minRole) ∪ {minRole}.
    if (minRole) {
      const accepted = this.isAncestorOrSelf(userRole, minRole);
      if (!accepted) {
        this.logDenied(request, classRef.name, handler.name, 'role_below_min', userRole);
        throw new ForbiddenException({
          code: RBAC_ERROR_CODES.MIN_ROLE_REQUIRED,
          message: `Min role '${minRole}' or ancestor required, got '${userRole}'`,
        });
      }
    }

    return true;
  }

  /**
   * Compute reverse hierarchy : child -> { all ancestors }.
   * RoleHierarchy[parent] = [direct children]. On inverse pour O(1) lookup.
   */
  private computeAncestors(): ReadonlyMap<AuthRole, ReadonlySet<AuthRole>> {
    const directParents = new Map<AuthRole, Set<AuthRole>>();
    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      directParents.set(role, new Set());
    }
    for (const [parent, children] of Object.entries(RoleHierarchy) as Array<
      [AuthRole, readonly AuthRole[]]
    >) {
      for (const child of children) {
        directParents.get(child)?.add(parent);
      }
    }

    // Transitive closure via DFS upward.
    const ancestors = new Map<AuthRole, Set<AuthRole>>();
    const compute = (role: AuthRole): Set<AuthRole> => {
      const cached = ancestors.get(role);
      if (cached) return cached;
      const acc = new Set<AuthRole>();
      ancestors.set(role, acc); // pre-set pour eviter cycles infinis (sanity)
      const parents = directParents.get(role) ?? new Set<AuthRole>();
      for (const parent of parents) {
        acc.add(parent);
        const grand = compute(parent);
        for (const g of grand) acc.add(g);
      }
      return acc;
    };

    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      compute(role);
    }

    return ancestors as ReadonlyMap<AuthRole, ReadonlySet<AuthRole>>;
  }

  /** user role est target lui-meme OU un ancetre de target. */
  isAncestorOrSelf(userRole: AuthRole, target: AuthRole): boolean {
    if (userRole === target) return true;
    const ancestorsOfTarget = this.ancestorsOf.get(target);
    return ancestorsOfTarget?.has(userRole) ?? false;
  }

  private logDenied(
    request: { method?: string; url?: string },
    controller: string,
    handler: string,
    reason: string,
    userRole: AuthRole | undefined,
  ): void {
    this.logger.warn(
      `role_access_denied controller=${controller} handler=${handler} method=${request.method ?? '-'} path=${request.url ?? '-'} role=${userRole ?? '-'} reason=${reason}`,
    );
  }
}
