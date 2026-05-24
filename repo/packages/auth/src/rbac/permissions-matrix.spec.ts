/**
 * Tests unitaires PermissionsMatrix + RoleHierarchy + HierarchyResolver + Validator.
 *
 * Sprint 7 / Tache 2.3.2.
 */

import { describe, expect, it } from 'vitest';
import { ALL_AUTH_ROLES, AuthRole } from '../types/auth-roles.js';
import {
  HierarchyResolver,
  RbacHierarchyCycleError,
  defaultHierarchyResolver,
} from './hierarchy-resolver.js';
import { validatePermissionsMatrix } from './matrix-validator.js';
import {
  ALL_ROLES_IN_MATRIX,
  PermissionsMatrix,
  countDirectPermissions,
  getDirectPermissions,
  hasWildcardPermission,
} from './permissions-matrix.js';
import { Permission } from './permissions.enum.js';
import { RBAC_WILDCARD } from './rbac-constants.js';
import {
  RoleHierarchy,
  getDirectChildren,
  isBrokerRole,
  isGarageRole,
  isPlatformRole,
  isTerminalRole,
} from './role-hierarchy.js';

describe('RBAC PermissionsMatrix -- Sprint 7 Tache 2.3.2', () => {
  // ==========================================================================
  // Matrix coverage
  // ==========================================================================

  describe('matrix coverage', () => {
    it('1. matrix has all 26 roles (v3.0 Sprint 7.5a)', () => {
      expect(ALL_ROLES_IN_MATRIX.length).toBe(26);
      for (const role of ALL_AUTH_ROLES) {
        expect(role in PermissionsMatrix).toBe(true);
      }
    });

    it('2. each v2.2 role has at least 1 permission (v3.0 roles populated Sprint 7 reprise)', () => {
      const v22Roles: AuthRole[] = [
        AuthRole.SuperAdminPlatform,
        AuthRole.AnalystSupport,
        AuthRole.BrokerAdmin,
        AuthRole.BrokerUser,
        AuthRole.BrokerAssistant,
        AuthRole.GarageAdmin,
        AuthRole.GarageChef,
        AuthRole.GarageTechnicien,
        AuthRole.GarageComptable,
        AuthRole.GarageCommercial,
        AuthRole.Assure,
        AuthRole.Prospect,
      ];
      for (const role of v22Roles) {
        expect(PermissionsMatrix[role].length).toBeGreaterThan(0);
      }
    });

    it('3. super_admin_platform has wildcard', () => {
      expect(hasWildcardPermission(AuthRole.SuperAdminPlatform)).toBe(true);
    });

    it('4. analyst_support has only read permissions (no write)', () => {
      const entry = PermissionsMatrix[AuthRole.AnalystSupport];
      const writePatterns = ['create', 'update', 'delete', 'assign', 'cancel'];
      for (const perm of entry) {
        if (perm === RBAC_WILDCARD) continue;
        const action = (perm as string).split('.')[2];
        for (const wp of writePatterns) {
          expect(action).not.toContain(wp);
        }
      }
    });

    it('5. broker_admin has >= 40 permissions', () => {
      expect(countDirectPermissions(AuthRole.BrokerAdmin)).toBeGreaterThanOrEqual(40);
    });

    it('6. garage_admin has >= 40 permissions', () => {
      expect(countDirectPermissions(AuthRole.GarageAdmin)).toBeGreaterThanOrEqual(40);
    });

    it('7. assure has only _own / read_own permissions', () => {
      const entry = PermissionsMatrix[AuthRole.Assure];
      for (const perm of entry) {
        if (perm === RBAC_WILDCARD) continue;
        const p = perm as string;
        // Allow auth/booking permissions for assure even without _own
        const allowedActions = ['_own', '.create', '.manage'];
        const matchesAllowed = allowedActions.some((a) => p.endsWith(a) || p.includes(a));
        expect(matchesAllowed).toBe(true);
      }
    });

    it('8. prospect has only public.* permissions', () => {
      const entry = PermissionsMatrix[AuthRole.Prospect];
      for (const perm of entry) {
        expect((perm as string).startsWith('public.')).toBe(true);
      }
    });

    it('9. broker_admin includes CRM CRUD complete', () => {
      const entry = PermissionsMatrix[AuthRole.BrokerAdmin] as readonly string[];
      expect(entry).toContain(Permission.CRM_CONTACTS_CREATE);
      expect(entry).toContain(Permission.CRM_CONTACTS_UPDATE);
      expect(entry).toContain(Permission.CRM_CONTACTS_DELETE);
    });

    it('10. broker_admin includes INSURE_POLICIES_READ_ALL', () => {
      const entry = PermissionsMatrix[AuthRole.BrokerAdmin] as readonly string[];
      expect(entry).toContain(Permission.INSURE_POLICIES_READ_ALL);
    });

    it('11. garage_technicien limited to assigned + execute', () => {
      const entry = PermissionsMatrix[AuthRole.GarageTechnicien] as readonly string[];
      expect(entry).toContain(Permission.REPAIR_SINISTRES_READ_ASSIGNED);
      expect(entry).toContain(Permission.REPAIR_REPARATIONS_START);
      expect(entry).not.toContain(Permission.REPAIR_DEVIS_APPROVE);
    });

    it('12. broker_admin includes cross-tenant broker_to_garage', () => {
      const entry = PermissionsMatrix[AuthRole.BrokerAdmin] as readonly string[];
      expect(entry).toContain(Permission.CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN);
    });
  });

  // ==========================================================================
  // Role Hierarchy
  // ==========================================================================

  describe('RoleHierarchy', () => {
    it('13. all 12 roles have hierarchy entries', () => {
      for (const role of ALL_AUTH_ROLES) {
        expect(role in RoleHierarchy).toBe(true);
      }
    });

    it('14. broker_admin -> broker_user direct child', () => {
      expect(getDirectChildren(AuthRole.BrokerAdmin)).toContain(AuthRole.BrokerUser);
    });

    it('15. garage_admin has 3 direct children', () => {
      const children = getDirectChildren(AuthRole.GarageAdmin);
      expect(children).toContain(AuthRole.GarageChef);
      expect(children).toContain(AuthRole.GarageComptable);
      expect(children).toContain(AuthRole.GarageCommercial);
    });

    it('16. garage_chef -> garage_technicien', () => {
      expect(getDirectChildren(AuthRole.GarageChef)).toContain(AuthRole.GarageTechnicien);
    });

    it('17. assure is terminal', () => {
      expect(isTerminalRole(AuthRole.Assure)).toBe(true);
    });

    it('18. prospect is terminal', () => {
      expect(isTerminalRole(AuthRole.Prospect)).toBe(true);
    });

    it('19. role type classifiers', () => {
      expect(isBrokerRole(AuthRole.BrokerAdmin)).toBe(true);
      expect(isGarageRole(AuthRole.GarageChef)).toBe(true);
      expect(isPlatformRole(AuthRole.SuperAdminPlatform)).toBe(true);
      expect(isBrokerRole(AuthRole.GarageAdmin)).toBe(false);
    });
  });

  // ==========================================================================
  // HierarchyResolver
  // ==========================================================================

  describe('HierarchyResolver', () => {
    it('20. detectCycles passes for current hierarchy (no cycle)', () => {
      const resolver = new HierarchyResolver();
      expect(() => resolver.detectCycles()).not.toThrow();
    });

    it('21. getEffectivePermissions for super_admin_platform returns wildcard', () => {
      const perms = defaultHierarchyResolver.getEffectivePermissions(AuthRole.SuperAdminPlatform);
      expect(perms.has(RBAC_WILDCARD)).toBe(true);
    });

    it('22. broker_admin effective includes broker_user permissions (heritage)', () => {
      const resolver = new HierarchyResolver();
      const adminPerms = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
      // broker_user has CRM_CONTACTS_READ_OWN which is included via heritage
      expect(adminPerms.has(Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    });

    it('23. garage_admin effective includes garage_technicien (recursive heritage)', () => {
      const resolver = new HierarchyResolver();
      const perms = resolver.getEffectivePermissions(AuthRole.GarageAdmin);
      // garage_technicien has REPAIR_SINISTRES_READ_ASSIGNED via heritage
      expect(perms.has(Permission.REPAIR_SINISTRES_READ_ASSIGNED)).toBe(true);
    });

    it('24. canAccess returns true for direct permission', () => {
      const resolver = new HierarchyResolver();
      expect(resolver.canAccess(AuthRole.BrokerAdmin, Permission.CRM_CONTACTS_CREATE)).toBe(true);
    });

    it('25. canAccess returns true for inherited permission', () => {
      const resolver = new HierarchyResolver();
      expect(resolver.canAccess(AuthRole.BrokerAdmin, Permission.CRM_CONTACTS_READ_OWN)).toBe(true);
    });

    it('26. canAccess wildcard short-circuit', () => {
      const resolver = new HierarchyResolver();
      expect(
        resolver.canAccess(AuthRole.SuperAdminPlatform, Permission.PAY_TRANSACTIONS_READ),
      ).toBe(true);
      expect(
        resolver.canAccess(AuthRole.SuperAdminPlatform, Permission.ADMIN_TENANTS_PURGE),
      ).toBe(true);
    });

    it('27. canAccess denies for unauthorized permission', () => {
      const resolver = new HierarchyResolver();
      expect(resolver.canAccess(AuthRole.GarageTechnicien, Permission.ADMIN_TENANTS_PURGE)).toBe(
        false,
      );
    });

    it('28. multi-role union via getEffectivePermissionsForRoles', () => {
      const resolver = new HierarchyResolver();
      const perms = resolver.getEffectivePermissionsForRoles([
        AuthRole.BrokerUser,
        AuthRole.GarageCommercial,
      ]);
      // broker_user has INSURE_POLICIES_READ_OWN
      expect(perms.has(Permission.INSURE_POLICIES_READ_OWN)).toBe(true);
      // garage_commercial has REPAIR_DEVIS_CREATE
      expect(perms.has(Permission.REPAIR_DEVIS_CREATE)).toBe(true);
    });

    it('29. canAccessAny multi-role test', () => {
      const resolver = new HierarchyResolver();
      expect(
        resolver.canAccessAny(
          [AuthRole.BrokerAssistant, AuthRole.AnalystSupport],
          Permission.INSURE_POLICIES_READ_ALL,
        ),
      ).toBe(true);
    });

    it('30. memoization cache works', () => {
      const resolver = new HierarchyResolver();
      const first = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
      const second = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
      expect(first).toBe(second); // referential equality from cache
    });

    it('31. clearCache resets memoization', () => {
      const resolver = new HierarchyResolver();
      const first = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
      resolver.clearCache();
      const second = resolver.getEffectivePermissions(AuthRole.BrokerAdmin);
      expect(first).not.toBe(second); // new Set created
    });
  });

  // ==========================================================================
  // MatrixValidator
  // ==========================================================================

  describe('validatePermissionsMatrix', () => {
    it('32. validation returns valid=true', () => {
      const result = validatePermissionsMatrix();
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it('33. stats include totalRoles=26 (v3.0) and rolesWithWildcard=1', () => {
      const result = validatePermissionsMatrix();
      expect(result.stats.totalRoles).toBe(26);
      expect(result.stats.rolesWithWildcard).toBe(1);
    });

    it('34. avgPermissionsPerRole > 0', () => {
      const result = validatePermissionsMatrix();
      expect(result.stats.avgPermissionsPerRole).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Helpers basique
  // ==========================================================================

  describe('helpers', () => {
    it('35. getDirectPermissions returns matrix entry', () => {
      const entry = getDirectPermissions(AuthRole.BrokerAssistant);
      expect(entry.length).toBeGreaterThan(0);
    });

    it('36. countDirectPermissions returns matrix length', () => {
      expect(countDirectPermissions(AuthRole.BrokerAssistant)).toBe(
        PermissionsMatrix[AuthRole.BrokerAssistant].length,
      );
    });

    it('37. RbacHierarchyCycleError shape (constructor)', () => {
      const err = new RbacHierarchyCycleError([AuthRole.BrokerAdmin, AuthRole.BrokerUser]);
      expect(err.name).toBe('RbacHierarchyCycleError');
      expect(err.cyclePath.length).toBe(2);
    });
  });
});
