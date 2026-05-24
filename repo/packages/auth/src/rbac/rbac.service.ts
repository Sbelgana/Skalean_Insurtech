/**
 * RbacService -- Sprint 7 Tache 2.3.3.
 *
 * Service NestJS centralisant l'evaluation des permissions RBAC sur les 26
 * roles v3.0 + 130 permissions du catalog Sprint 7.5a Foundation Migration.
 *
 * API publique :
 *   - canAccess(role, permission, abacContext?)        -- evaluation unique
 *   - canAccessAny(role, permissions[])                -- OR logic
 *   - canAccessAll(role, permissions[])                -- AND logic
 *   - canAccessAnyForRoles(roles[], permission)        -- multi-role user
 *   - getEffectivePermissions(role)                    -- snapshot resolu
 *   - getRolesByPermission(permission)                 -- inverse mapping
 *
 * Architecture :
 *   - Delegation a HierarchyResolver (Sprint 7.5a) pour resolution
 *     hierarchique memoizee in-process.
 *   - Wildcard super_admin_platform short-circuit (allowed=true immediat).
 *   - ABAC context : Sprint 7 Tache 2.3.7 fournira AbacService injecte ici
 *     pour les permissions `*_own` / `*_assigned` / scoped resource.
 *   - Cache Redis distribue : Sprint 7 Tache 2.3.10 ajoutera
 *     PermissionCacheService inject via @Inject('PERMISSION_CACHE') token.
 *
 * Boot-time validation (OnApplicationBootstrap dans le module consommateur) :
 *   - HierarchyResolver.detectCycles() => echec fail-fast si cycle.
 *   - validatePermissionsMatrix() => echec si permission inconnue / wildcard
 *     hors super_admin / cross-domain inheritance.
 *
 * Reference :
 *   - B-07 Tache 2.3.3
 *   - decision-006 (no-emoji) + decision-012/013/014 (v3.0 scope)
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthRole } from '../types/auth-roles.js';
import {
  defaultHierarchyResolver,
  type HierarchyResolver,
} from './hierarchy-resolver.js';
import { ALL_ROLES_IN_MATRIX } from './permissions-matrix.js';
import type { PermissionValue } from './permissions.enum.js';
import { RBAC_ERROR_CODES, RBAC_WILDCARD, type RbacErrorCode } from './rbac-constants.js';

export interface RbacAccessResult {
  readonly allowed: boolean;
  /**
   * Reason code stable for guards / clients :
   *   - undefined si allowed=true
   *   - 'PERMISSION_NOT_GRANTED' si role n'a pas la permission effective
   *   - 'NO_USER_CONTEXT' si role/permission inputs invalides
   *   - 'ABAC_DENIED' si ABAC policy ulterieure refuse (placeholder Sprint 7 Tache 2.3.7)
   */
  readonly reason?: RbacErrorCode;
  /** Permission requise (echo pour audit log). */
  readonly permission?: PermissionValue;
  /** Role evalue (echo pour audit log). */
  readonly role?: AuthRole;
}

/**
 * ABAC context placeholder. Sprint 7 Tache 2.3.6 livrera le type complet
 * AbacContext avec resource, owner, status, timestamps. Cette interface
 * minimaliste permet d'enregistrer la signature sans bloquer Sprint 7 2.3.3.
 */
export interface RbacAbacContext {
  readonly userId?: string;
  readonly tenantId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly resourceOwnerId?: string;
  readonly resourceStatus?: string;
  readonly resourceAssigneeId?: string;
  readonly now?: Date;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private readonly resolver: HierarchyResolver = defaultHierarchyResolver) {}

  /**
   * Evaluation principale : retourne allowed=true/false + reason.
   *
   * Ordre d'evaluation :
   *   1. Inputs valides (role, permission non-null) ; sinon NO_USER_CONTEXT.
   *   2. super_admin_platform wildcard short-circuit -> allowed=true.
   *   3. Lookup effective permissions du role (memoized).
   *   4. Si permission dans set effectif -> allowed=true.
   *   5. ABAC context provided -> placeholder Tache 2.3.7 (renvoie deny
   *      conservateur pour Sprint 7 2.3.3 -- les `*_own` perms necessitent
   *      ABAC pour passer).
   *   6. Sinon -> PERMISSION_NOT_GRANTED.
   */
  canAccess(
    role: AuthRole,
    permission: PermissionValue,
    abacContext?: RbacAbacContext,
  ): RbacAccessResult {
    if (!role || !permission) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        role,
        permission,
      };
    }

    // Wildcard short-circuit : super_admin_platform.
    const effective = this.resolver.getEffectivePermissions(role);
    if (effective.has(RBAC_WILDCARD)) {
      return { allowed: true, role, permission };
    }

    if (effective.has(permission)) {
      return { allowed: true, role, permission };
    }

    // ABAC context fourni mais aucune AbacService injectee a Sprint 7 2.3.3.
    // Le placeholder retourne ABAC_DENIED conservateur pour signaler que la
    // permission existe ailleurs (e.g. en *_own variant) mais ABAC pas encore
    // implementee. Tache 2.3.7 reglera ce comportement.
    if (abacContext) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.ABAC_DENIED,
        role,
        permission,
      };
    }

    return {
      allowed: false,
      reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
      role,
      permission,
    };
  }

  /** OR logic : true si AU MOINS une permission accordee. */
  canAccessAny(
    role: AuthRole,
    permissions: readonly PermissionValue[],
    abacContext?: RbacAbacContext,
  ): RbacAccessResult {
    if (!role || permissions.length === 0) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        role,
      };
    }

    // Wildcard short-circuit
    const effective = this.resolver.getEffectivePermissions(role);
    if (effective.has(RBAC_WILDCARD)) {
      const first = permissions[0];
      return first !== undefined
        ? { allowed: true, role, permission: first }
        : { allowed: true, role };
    }

    for (const perm of permissions) {
      if (effective.has(perm)) {
        return { allowed: true, role, permission: perm };
      }
    }

    if (abacContext) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.ABAC_DENIED,
        role,
      };
    }

    return {
      allowed: false,
      reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
      role,
    };
  }

  /** AND logic : true si TOUTES permissions accordees. */
  canAccessAll(
    role: AuthRole,
    permissions: readonly PermissionValue[],
    abacContext?: RbacAbacContext,
  ): RbacAccessResult {
    if (!role || permissions.length === 0) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        role,
      };
    }

    // Wildcard short-circuit
    const effective = this.resolver.getEffectivePermissions(role);
    if (effective.has(RBAC_WILDCARD)) {
      return { allowed: true, role };
    }

    for (const perm of permissions) {
      if (!effective.has(perm)) {
        if (abacContext) {
          return {
            allowed: false,
            reason: RBAC_ERROR_CODES.ABAC_DENIED,
            role,
            permission: perm,
          };
        }
        return {
          allowed: false,
          reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
          role,
          permission: perm,
        };
      }
    }

    return { allowed: true, role };
  }

  /**
   * Multi-role user : union des permissions. Wildcard d'un seul role suffit.
   */
  canAccessAnyForRoles(
    roles: readonly AuthRole[],
    permission: PermissionValue,
  ): RbacAccessResult {
    if (roles.length === 0 || !permission) {
      return {
        allowed: false,
        reason: RBAC_ERROR_CODES.NO_USER_CONTEXT,
        permission,
      };
    }

    const allowed = this.resolver.canAccessAny(roles, permission);
    if (allowed) {
      return { allowed: true, permission };
    }

    return {
      allowed: false,
      reason: RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED,
      permission,
    };
  }

  /**
   * Snapshot des permissions effectives (directes + heritees).
   * Wildcard role retourne un set contenant uniquement RBAC_WILDCARD.
   */
  getEffectivePermissions(role: AuthRole): ReadonlySet<PermissionValue | typeof RBAC_WILDCARD> {
    return this.resolver.getEffectivePermissions(role);
  }

  /** Liste des roles ayant une permission specifique (inverse mapping). */
  getRolesByPermission(permission: PermissionValue): readonly AuthRole[] {
    const roles: AuthRole[] = [];
    for (const role of ALL_ROLES_IN_MATRIX) {
      const effective = this.resolver.getEffectivePermissions(role);
      if (effective.has(RBAC_WILDCARD) || effective.has(permission)) {
        roles.push(role);
      }
    }
    return roles;
  }

  /**
   * Reset cache. Utile pour tests + apres rotation matrix.
   * Sprint 7 Tache 2.3.10 ajoutera cache invalidation distribue Redis.
   */
  clearCache(): void {
    this.resolver.clearCache();
    this.logger.log('RbacService cache cleared');
  }
}
