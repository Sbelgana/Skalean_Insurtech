/**
 * AdminPermissionsService -- Sprint 7 Tache 2.3.11.
 *
 * Logique metier pour endpoints super admin d'introspection RBAC.
 *
 * Pas de mutation matrix (code-as-config Sprint 7) -- read-only.
 * Sprint 32+ : extension custom permissions per tenant (Phase 7+).
 *
 * Reference : B-07 Tache 2.3.11.
 */

import { Injectable } from '@nestjs/common';
import {
  ALL_AUTH_ROLES,
  ALL_PERMISSIONS,
  AuthRole,
  isBrokerRole,
  isCarrierRole,
  isExpertRole,
  isGarageRole,
  isPlatformRole,
  isTenantRole,
  isTowRole,
  Module,
  PermissionsByModule,
  RBAC_WILDCARD,
  RbacService,
  RoleHierarchy,
  RoleMetadata,
  getDirectPermissions,
  type PermissionValue,
} from '@insurtech/auth';

export interface RoleSummaryDto {
  readonly role: AuthRole;
  readonly level: number;
  readonly tenantType: string;
  readonly descriptionFr: string;
  readonly directChildren: readonly AuthRole[];
  readonly directPermissionsCount: number;
  readonly effectivePermissionsCount: number;
  readonly hasWildcard: boolean;
}

export interface RolePermissionsDetailDto {
  readonly role: AuthRole;
  readonly directPermissions: readonly string[];
  readonly inheritedFrom: ReadonlyArray<{
    readonly role: AuthRole;
    readonly permissions: readonly string[];
  }>;
  readonly effectivePermissions: readonly string[];
}

export interface PermissionsCatalogDto {
  readonly totalCount: number;
  readonly byModule: Record<string, readonly string[]>;
  readonly modules: readonly string[];
}

@Injectable()
export class AdminPermissionsService {
  constructor(private readonly rbac: RbacService) {}

  /** GET /admin/rbac/roles : liste des 26 roles + meta. */
  listRoles(): readonly RoleSummaryDto[] {
    return ALL_AUTH_ROLES.map((role) => this.buildSummary(role));
  }

  /** GET /admin/rbac/roles/:role : detail permissions + heritage. */
  getRoleDetail(role: AuthRole): RolePermissionsDetailDto {
    const directEntry = getDirectPermissions(role);
    const directPermissions = Array.from(directEntry) as string[];

    const inheritedFrom: Array<{ role: AuthRole; permissions: readonly string[] }> = [];
    const visited = new Set<AuthRole>([role]);
    const queue: AuthRole[] = [...RoleHierarchy[role]];
    while (queue.length > 0) {
      const child = queue.shift()!;
      if (visited.has(child)) continue;
      visited.add(child);
      const childPerms = Array.from(getDirectPermissions(child)) as string[];
      inheritedFrom.push({ role: child, permissions: childPerms });
      queue.push(...RoleHierarchy[child]);
    }

    const effective = this.rbac.getEffectivePermissions(role);
    const effectivePermissions = Array.from(effective).map((p) => String(p));

    return {
      role,
      directPermissions,
      inheritedFrom,
      effectivePermissions,
    };
  }

  /** GET /admin/rbac/permissions : catalog par module. */
  getPermissionsCatalog(): PermissionsCatalogDto {
    const byModule: Record<string, string[]> = {};
    const moduleValues = Object.values(Module) as string[];
    for (const mod of moduleValues) {
      byModule[mod] = (PermissionsByModule[mod] ?? []).map((p) => String(p));
    }
    const totalCount = ALL_PERMISSIONS.length;
    return {
      totalCount,
      byModule,
      modules: moduleValues,
    };
  }

  /** GET /admin/rbac/roles/by-permission/:permission : inverse mapping. */
  getRolesByPermission(permission: PermissionValue): readonly AuthRole[] {
    return this.rbac.getRolesByPermission(permission);
  }

  /** POST /admin/rbac/cache/invalidate : trigger cache flush via PermissionCacheService (a inject Sprint 7.5b+). */
  clearLocalCache(): { cleared: true } {
    this.rbac.clearCache();
    return { cleared: true };
  }

  private buildSummary(role: AuthRole): RoleSummaryDto {
    const meta = RoleMetadata[role];
    const directEntry = getDirectPermissions(role);
    const effective = this.rbac.getEffectivePermissions(role);
    const hasWildcard = effective.has(RBAC_WILDCARD);
    return {
      role,
      level: meta?.level ?? 5,
      tenantType: meta?.tenantType ?? this.tenantTypeOf(role),
      descriptionFr: meta?.descriptionFr ?? '',
      directChildren: RoleHierarchy[role] ?? [],
      directPermissionsCount: directEntry.length,
      effectivePermissionsCount: hasWildcard ? -1 : effective.size,
      hasWildcard,
    };
  }

  private tenantTypeOf(role: AuthRole): string {
    if (isPlatformRole(role)) return 'platform';
    if (isBrokerRole(role)) return 'broker';
    if (isGarageRole(role)) return 'garage';
    if (isCarrierRole(role)) return 'carrier';
    if (isExpertRole(role)) return 'expert';
    if (isTowRole(role)) return 'tow';
    if (isTenantRole(role)) return 'tenant';
    return 'public';
  }
}
