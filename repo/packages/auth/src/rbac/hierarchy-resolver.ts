/**
 * HierarchyResolver -- Sprint 7 Tache 2.3.2.
 *
 * Resolution recursive permissions effectives avec memoization.
 * Detection cycles + profondeur DFS au boot.
 *
 * Usage :
 *   const resolver = new HierarchyResolver();
 *   resolver.detectCycles(); // boot-time
 *   const perms = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
 */

import { AuthRole } from '../types/auth-roles.js';
import type { PermissionValue } from './permissions.enum.js';
import {
  PermissionsMatrix,
  hasWildcardPermission,
} from './permissions-matrix.js';
import { RoleHierarchy } from './role-hierarchy.js';
import { RBAC_WILDCARD } from './rbac-constants.js';

export const DEFAULT_DEPTH_LIMIT = 8;

export class RbacHierarchyCycleError extends Error {
  constructor(public readonly cyclePath: AuthRole[]) {
    super(`Cycle detected in role hierarchy: ${cyclePath.join(' -> ')}`);
    this.name = 'RbacHierarchyCycleError';
  }
}

export class RbacHierarchyDepthError extends Error {
  constructor(
    public readonly role: AuthRole,
    public readonly depth: number,
  ) {
    super(`Hierarchy depth exceeded for role '${role}': ${depth} > limit`);
    this.name = 'RbacHierarchyDepthError';
  }
}

export type EffectivePermissionsSet = ReadonlySet<PermissionValue | typeof RBAC_WILDCARD>;

export interface HierarchyResolverOptions {
  depthLimit?: number;
}

export class HierarchyResolver {
  private readonly cache = new Map<AuthRole, EffectivePermissionsSet>();
  private readonly depthLimit: number;

  constructor(options: HierarchyResolverOptions = {}) {
    this.depthLimit = options.depthLimit ?? DEFAULT_DEPTH_LIMIT;
  }

  /**
   * Detection cycles boot-time via DFS WHITE/GRAY/BLACK.
   * @throws RbacHierarchyCycleError si cycle detecte.
   */
  detectCycles(): void {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<AuthRole, number>();
    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      color.set(role, WHITE);
    }

    const dfs = (role: AuthRole, path: AuthRole[]): void => {
      color.set(role, GRAY);
      path.push(role);
      const children = RoleHierarchy[role] ?? [];
      for (const child of children) {
        const c = color.get(child) ?? WHITE;
        if (c === GRAY) {
          throw new RbacHierarchyCycleError([...path, child]);
        }
        if (c === WHITE) {
          dfs(child, path);
        }
      }
      path.pop();
      color.set(role, BLACK);
    };

    for (const role of Object.keys(RoleHierarchy) as AuthRole[]) {
      if (color.get(role) === WHITE) {
        dfs(role, []);
      }
    }
  }

  /**
   * Retourne permissions effectives (directes + heritees recursive).
   * Memoize par role. Wildcard short-circuit.
   *
   * @throws RbacHierarchyDepthError si depthLimit depasse.
   */
  getEffectivePermissions(role: AuthRole): EffectivePermissionsSet {
    const cached = this.cache.get(role);
    if (cached) return cached;

    // Wildcard short-circuit
    if (hasWildcardPermission(role)) {
      const wildcardSet: EffectivePermissionsSet = new Set([RBAC_WILDCARD]);
      this.cache.set(role, wildcardSet);
      return wildcardSet;
    }

    const result = new Set<PermissionValue | typeof RBAC_WILDCARD>();
    this.collectRecursive(role, result, 0);
    const frozen = result as EffectivePermissionsSet;
    this.cache.set(role, frozen);
    return frozen;
  }

  private collectRecursive(
    role: AuthRole,
    acc: Set<PermissionValue | typeof RBAC_WILDCARD>,
    depth: number,
  ): void {
    if (depth > this.depthLimit) {
      throw new RbacHierarchyDepthError(role, depth);
    }

    const directEntry = PermissionsMatrix[role];
    if (directEntry) {
      for (const perm of directEntry) {
        acc.add(perm);
      }
    }

    const children = RoleHierarchy[role] ?? [];
    for (const child of children) {
      this.collectRecursive(child, acc, depth + 1);
    }
  }

  /**
   * Verifie si role peut acceder a permission (effective).
   * Wildcard short-circuit.
   */
  canAccess(role: AuthRole, permission: PermissionValue): boolean {
    const effective = this.getEffectivePermissions(role);
    if (effective.has(RBAC_WILDCARD)) return true;
    return effective.has(permission);
  }

  /** Union permissions de plusieurs roles (multi-role user). */
  getEffectivePermissionsForRoles(roles: readonly AuthRole[]): EffectivePermissionsSet {
    const union = new Set<PermissionValue | typeof RBAC_WILDCARD>();
    for (const role of roles) {
      const effective = this.getEffectivePermissions(role);
      if (effective.has(RBAC_WILDCARD)) {
        return new Set([RBAC_WILDCARD]);
      }
      for (const perm of effective) {
        union.add(perm);
      }
    }
    return union;
  }

  /** Test si user multi-role peut acceder. */
  canAccessAny(roles: readonly AuthRole[], permission: PermissionValue): boolean {
    const effective = this.getEffectivePermissionsForRoles(roles);
    if (effective.has(RBAC_WILDCARD)) return true;
    return effective.has(permission);
  }

  /** Reset cache (tests + role updates). */
  clearCache(): void {
    this.cache.clear();
  }
}

/** Singleton default pour usage simple sans DI. */
export const defaultHierarchyResolver = new HierarchyResolver();
