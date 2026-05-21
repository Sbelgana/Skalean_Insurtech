/**
 * Groupage permissions par module.
 *
 * Sprint 7 / Tache 2.3.1.
 */

import { ALL_PERMISSIONS, type PermissionValue } from './permissions.enum.js';
import {
  ALL_MODULES,
  getModuleFromPermission,
  type ModuleValue,
} from './permission-helpers.js';

/**
 * Map runtime { module -> [permissions] }. Construit au load.
 * Single source of truth : iterate ALL_PERMISSIONS et groupe par module parse.
 */
export const PermissionsByModule: Readonly<Record<string, readonly PermissionValue[]>> =
  (() => {
    const acc: Record<string, PermissionValue[]> = {};
    for (const mod of ALL_MODULES) {
      acc[mod] = [];
    }
    for (const perm of ALL_PERMISSIONS) {
      const mod = getModuleFromPermission(perm);
      if (!acc[mod]) acc[mod] = [];
      acc[mod]!.push(perm);
    }
    for (const key of Object.keys(acc)) {
      acc[key] = Object.freeze(acc[key]) as PermissionValue[];
    }
    return Object.freeze(acc);
  })();

export function getPermissionsByModule(
  module: ModuleValue | string,
): readonly PermissionValue[] {
  return PermissionsByModule[module] ?? [];
}

export function getPermissionCountByModule(): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const [mod, perms] of Object.entries(PermissionsByModule)) {
    result[mod] = perms.length;
  }
  return Object.freeze(result);
}

export function getActiveModules(): readonly string[] {
  const active: string[] = [];
  for (const [mod, perms] of Object.entries(PermissionsByModule)) {
    if (perms.length > 0) active.push(mod);
  }
  return Object.freeze(active.sort());
}

/**
 * Permissions tagguees _own (cross-modules). Utilise par AbacService Tache 2.3.7.
 */
export function getAllOwnPermissions(): readonly PermissionValue[] {
  return Object.freeze(
    ALL_PERMISSIONS.filter((p) => p.endsWith('_own') || p.endsWith('.read_assigned')),
  );
}

/**
 * Permissions read-only (read, read_own, read_all, read_assigned). Pour analyst_support.
 */
export function getAllReadPermissions(): readonly PermissionValue[] {
  return Object.freeze(
    ALL_PERMISSIONS.filter((p) => {
      const action = p.split('.')[2];
      return (
        action === 'read' ||
        action === 'read_own' ||
        action === 'read_all' ||
        action === 'read_assigned'
      );
    }),
  );
}
