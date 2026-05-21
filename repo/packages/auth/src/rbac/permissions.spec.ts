/**
 * Tests unitaires catalog 85+ permissions + helpers.
 *
 * Sprint 7 / Tache 2.3.1.
 */

import { describe, expect, it } from 'vitest';
import { AuthRole, ALL_AUTH_ROLES } from '../types/auth-roles.js';
import {
  ALL_MODULES,
  formatPermission,
  getActionFromPermission,
  getModuleFromPermission,
  isOwnPermission,
  isValidPermission,
  parsePermission,
} from './permission-helpers.js';
import {
  PermissionsByModule,
  getActiveModules,
  getAllOwnPermissions,
  getAllReadPermissions,
  getPermissionsByModule,
} from './permissions-by-module.js';
import { ALL_PERMISSIONS, Permission, PermissionKeys } from './permissions.enum.js';
import { validatePermissionsCatalog } from './permissions-validator.js';
import { PERMISSION_NAMING_REGEX, RBAC_ERROR_CODES, RBAC_WILDCARD } from './rbac-constants.js';
import { ROLES_BY_LEVEL, RoleMetadata } from './role-metadata.js';

describe('RBAC catalog -- Permission + helpers + metadata', () => {
  // ==========================================================================
  // Permission enum count + uniqueness
  // ==========================================================================

  it('1. has at least 85 permissions', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(85);
  });

  it('2. all permissions are unique', () => {
    const set = new Set(ALL_PERMISSIONS);
    expect(set.size).toBe(ALL_PERMISSIONS.length);
  });

  it('3. all permissions respect naming regex', () => {
    for (const perm of ALL_PERMISSIONS) {
      expect(PERMISSION_NAMING_REGEX.test(perm)).toBe(true);
    }
  });

  it('4. PermissionKeys match Permission values count', () => {
    expect(PermissionKeys.length).toBe(ALL_PERMISSIONS.length);
  });

  // ==========================================================================
  // Roles
  // ==========================================================================

  it('5. has exactly 12 roles', () => {
    expect(ALL_AUTH_ROLES.length).toBe(12);
  });

  it('6. RoleMetadata has entries for all 12 roles', () => {
    for (const role of ALL_AUTH_ROLES) {
      expect(RoleMetadata[role]).toBeDefined();
    }
  });

  it('7. ROLES_BY_LEVEL sorts by ascending level', () => {
    expect(ROLES_BY_LEVEL[0]).toBe(AuthRole.SuperAdminPlatform);
  });

  // ==========================================================================
  // Modules
  // ==========================================================================

  it('8. has 20 modules', () => {
    expect(ALL_MODULES.length).toBe(20);
  });

  it('9. every permission has a valid module', () => {
    const moduleSet = new Set<string>(ALL_MODULES);
    for (const perm of ALL_PERMISSIONS) {
      const mod = getModuleFromPermission(perm);
      expect(moduleSet.has(mod)).toBe(true);
    }
  });

  it('10. PermissionsByModule includes all permissions', () => {
    let total = 0;
    for (const perms of Object.values(PermissionsByModule)) {
      total += perms.length;
    }
    expect(total).toBe(ALL_PERMISSIONS.length);
  });

  it('11. getActiveModules returns >= 18 modules with permissions', () => {
    const active = getActiveModules();
    expect(active.length).toBeGreaterThanOrEqual(18);
  });

  // ==========================================================================
  // Helpers
  // ==========================================================================

  it('12. parsePermission returns 3 parts for valid input', () => {
    const parsed = parsePermission('crm.contacts.read');
    expect(parsed).toEqual({
      module: 'crm',
      resource: 'contacts',
      action: 'read',
      raw: 'crm.contacts.read',
    });
  });

  it('13. parsePermission throws for invalid format', () => {
    expect(() => parsePermission('invalid')).toThrow();
    expect(() => parsePermission('CRM.CONTACTS.READ')).toThrow();
    expect(() => parsePermission('crm.contacts')).toThrow();
  });

  it('14. isValidPermission returns true for catalog permissions', () => {
    expect(isValidPermission('crm.contacts.read')).toBe(true);
    expect(isValidPermission('insure.policies.create')).toBe(true);
  });

  it('15. isValidPermission rejects wildcard', () => {
    expect(isValidPermission(RBAC_WILDCARD)).toBe(false);
  });

  it('16. isValidPermission rejects non-catalog strings', () => {
    expect(isValidPermission('crm.fake.read')).toBe(false);
    expect(isValidPermission(null)).toBe(false);
    expect(isValidPermission(undefined)).toBe(false);
  });

  it('17. formatPermission constructs valid permission', () => {
    expect(formatPermission('crm', 'contacts', 'read')).toBe('crm.contacts.read');
  });

  it('18. formatPermission throws for unknown combination', () => {
    expect(() => formatPermission('crm', 'inexistant_resource', 'read')).toThrow();
  });

  it('19. getModuleFromPermission extracts module', () => {
    expect(getModuleFromPermission(Permission.INSURE_POLICIES_CREATE)).toBe('insure');
  });

  it('20. getActionFromPermission extracts action', () => {
    expect(getActionFromPermission(Permission.CRM_CONTACTS_READ_OWN)).toBe('read_own');
  });

  it('21. isOwnPermission detects _own suffix', () => {
    expect(isOwnPermission(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    expect(isOwnPermission(Permission.REPAIR_SINISTRES_READ_ASSIGNED)).toBe(true);
    expect(isOwnPermission(Permission.CRM_CONTACTS_READ)).toBe(false);
  });

  // ==========================================================================
  // Filtering helpers
  // ==========================================================================

  it('22. getAllOwnPermissions returns subset with _own / read_assigned', () => {
    const own = getAllOwnPermissions();
    expect(own.length).toBeGreaterThan(0);
    for (const p of own) {
      expect(isOwnPermission(p)).toBe(true);
    }
  });

  it('23. getAllReadPermissions covers all read variants', () => {
    const reads = getAllReadPermissions();
    expect(reads.length).toBeGreaterThan(0);
    for (const p of reads) {
      const action = p.split('.')[2];
      expect(['read', 'read_own', 'read_all', 'read_assigned']).toContain(action);
    }
  });

  // ==========================================================================
  // Validator
  // ==========================================================================

  it('24. validatePermissionsCatalog returns valid=true', () => {
    const result = validatePermissionsCatalog();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('25. RBAC_ERROR_CODES has expected codes', () => {
    expect(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED).toBe('PERMISSION_NOT_GRANTED');
    expect(RBAC_ERROR_CODES.ROLE_REQUIRED).toBe('ROLE_REQUIRED');
    expect(RBAC_ERROR_CODES.ABAC_DENIED).toBe('ABAC_DENIED');
  });

  // ==========================================================================
  // Module coverage
  // ==========================================================================

  it('26. CRM module has >= 15 permissions', () => {
    expect(getPermissionsByModule('crm').length).toBeGreaterThanOrEqual(15);
  });

  it('27. INSURE module has >= 10 permissions', () => {
    expect(getPermissionsByModule('insure').length).toBeGreaterThanOrEqual(10);
  });

  it('28. REPAIR module has >= 12 permissions', () => {
    expect(getPermissionsByModule('repair').length).toBeGreaterThanOrEqual(12);
  });
});
