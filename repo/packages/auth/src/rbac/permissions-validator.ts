/**
 * Validator boot-time du catalog RBAC.
 *
 * Sprint 7 / Tache 2.3.1.
 */

import { ALL_PERMISSIONS } from './permissions.enum.js';
import { ALL_MODULES, parsePermission } from './permission-helpers.js';
import { PERMISSION_NAMING_REGEX } from './rbac-constants.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valide la coherence du catalog permissions (run au boot).
 *
 * Verifications :
 *   - Naming regex respect
 *   - Module appartient a ALL_MODULES
 *   - No duplicates
 *   - No wildcards
 *   - Min 85 permissions
 *   - Max <= MAX_PERMISSIONS_PER_ROLE * 12 (sanite globale)
 */
export function validatePermissionsCatalog(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const modules = new Set<string>(ALL_MODULES);

  for (const perm of ALL_PERMISSIONS) {
    if (!PERMISSION_NAMING_REGEX.test(perm)) {
      errors.push(`Permission '${perm}' fails naming regex`);
      continue;
    }
    if (seen.has(perm)) {
      errors.push(`Duplicate permission '${perm}'`);
    }
    seen.add(perm);

    try {
      const parsed = parsePermission(perm);
      if (!modules.has(parsed.module)) {
        errors.push(`Permission '${perm}' uses unknown module '${parsed.module}'`);
      }
    } catch (err) {
      errors.push(`Parse error '${perm}': ${(err as Error).message}`);
    }
  }

  if (ALL_PERMISSIONS.length < 85) {
    errors.push(`Permissions count ${ALL_PERMISSIONS.length} < 85 minimum`);
  }

  if (ALL_PERMISSIONS.length > 150) {
    warnings.push(
      `Permissions count ${ALL_PERMISSIONS.length} > 150 -- consider splitting modules`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
