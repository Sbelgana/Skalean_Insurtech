/**
 * MatrixValidator -- Sprint 7 Tache 2.3.2.
 *
 * Verifie coherence PermissionsMatrix + RoleHierarchy au boot.
 */

import { AuthRole, ALL_AUTH_ROLES } from '../types/auth-roles.js';
import { ALL_PERMISSIONS } from './permissions.enum.js';
import { PermissionsMatrix, hasWildcardPermission } from './permissions-matrix.js';
import { RoleHierarchy, isBrokerRole, isGarageRole } from './role-hierarchy.js';
import { HierarchyResolver } from './hierarchy-resolver.js';
import { RBAC_WILDCARD } from './rbac-constants.js';

export interface MatrixValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRoles: number;
    totalPermissionsAcrossRoles: number;
    rolesWithWildcard: number;
    avgPermissionsPerRole: number;
  };
}

/**
 * Valide coherence matrix + hierarchy. A appeler au boot via RbacModule.
 */
export function validatePermissionsMatrix(): MatrixValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allPermSet = new Set<string>(ALL_PERMISSIONS);
  let total = 0;
  let withWildcard = 0;

  // 1. Tous les roles AuthRole doivent etre dans la matrix
  for (const role of ALL_AUTH_ROLES) {
    if (!(role in PermissionsMatrix)) {
      errors.push(`Role '${role}' missing in PermissionsMatrix`);
    }
    if (!(role in RoleHierarchy)) {
      errors.push(`Role '${role}' missing in RoleHierarchy`);
    }
  }

  // 2. Verifier permissions referencees existent dans catalog + no duplicates + wildcard unique super_admin
  for (const [role, entry] of Object.entries(PermissionsMatrix)) {
    const seen = new Set<string>();
    let hasWildcardInEntry = false;
    for (const perm of entry) {
      if (perm === RBAC_WILDCARD) {
        hasWildcardInEntry = true;
        if (role !== AuthRole.SuperAdminPlatform) {
          errors.push(`Role '${role}' has wildcard but is not super_admin_platform`);
        }
        continue;
      }
      if (!allPermSet.has(perm)) {
        errors.push(`Role '${role}' references unknown permission '${perm}'`);
      }
      if (seen.has(perm)) {
        errors.push(`Role '${role}' has duplicate permission '${perm}'`);
      }
      seen.add(perm);
    }
    if (hasWildcardInEntry && entry.length > 1) {
      errors.push(`Role '${role}' has wildcard mixed with other permissions`);
    }
    if (hasWildcardInEntry) withWildcard += 1;
    total += entry.length;
  }

  // 3. super_admin_platform DOIT avoir wildcard
  if (!hasWildcardPermission(AuthRole.SuperAdminPlatform)) {
    errors.push(`super_admin_platform must have wildcard permission`);
  }

  // 4. analyst_support read-only : aucune permission write
  const analystEntry = PermissionsMatrix[AuthRole.AnalystSupport];
  const writePatterns = ['create', 'update', 'delete', 'assign', 'cancel', 'manage', 'execute'];
  for (const perm of analystEntry) {
    if (perm === RBAC_WILDCARD) continue;
    const action = (perm as string).split('.')[2];
    if (action && writePatterns.some((wp) => action.includes(wp))) {
      warnings.push(`analyst_support has write-like permission '${perm}'`);
    }
  }

  // 5. Cross-domain check : broker role ne doit pas inherit garage et inversement
  for (const [parent, children] of Object.entries(RoleHierarchy)) {
    const parentRole = parent as AuthRole;
    for (const child of children) {
      if (isBrokerRole(parentRole) && isGarageRole(child)) {
        errors.push(`Cross-domain hierarchy : broker '${parent}' inherits garage '${child}'`);
      }
      if (isGarageRole(parentRole) && isBrokerRole(child)) {
        errors.push(`Cross-domain hierarchy : garage '${parent}' inherits broker '${child}'`);
      }
    }
  }

  // 6. Cycle detection via HierarchyResolver
  try {
    const resolver = new HierarchyResolver();
    resolver.detectCycles();
  } catch (err) {
    errors.push(`Cycle detected : ${(err as Error).message}`);
  }

  const totalRoles = Object.keys(PermissionsMatrix).length;
  const avgPermissionsPerRole = totalRoles > 0 ? Math.round(total / totalRoles) : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalRoles,
      totalPermissionsAcrossRoles: total,
      rolesWithWildcard: withWildcard,
      avgPermissionsPerRole,
    },
  };
}
