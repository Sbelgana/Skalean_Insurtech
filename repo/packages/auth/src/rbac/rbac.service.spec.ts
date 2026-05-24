/**
 * Tests RbacService -- Sprint 7 Tache 2.3.3.
 *
 * Couvre :
 *   - canAccess : evaluation unique (3 roles representatifs)
 *   - canAccessAny : OR logic
 *   - canAccessAll : AND logic
 *   - canAccessAnyForRoles : multi-role user (union)
 *   - getEffectivePermissions : snapshot resolu
 *   - getRolesByPermission : inverse mapping
 *   - Wildcard short-circuit super_admin_platform
 *   - ABAC context placeholder (Sprint 7 Tache 2.3.7)
 *   - Error codes coherents avec RBAC_ERROR_CODES
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AuthRole } from '../types/auth-roles.js';
import { HierarchyResolver } from './hierarchy-resolver.js';
import { Permission } from './permissions.enum.js';
import { RbacService } from './rbac.service.js';
import { RBAC_ERROR_CODES, RBAC_WILDCARD } from './rbac-constants.js';

describe('RbacService (Sprint 7 Tache 2.3.3)', () => {
  let service: RbacService;

  beforeEach(() => {
    // Fresh resolver per test pour isoler le cache memoize.
    service = new RbacService(new HierarchyResolver());
  });

  // ==========================================================================
  // canAccess -- evaluation unique
  // ==========================================================================

  describe('canAccess', () => {
    it('1. super_admin_platform : allowed=true pour TOUTE permission (wildcard)', () => {
      const result = service.canAccess(
        AuthRole.SuperAdminPlatform,
        Permission.CRM_CONTACTS_CREATE,
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('2. super_admin_platform : allowed=true meme pour permission rare', () => {
      const result = service.canAccess(
        AuthRole.SuperAdminPlatform,
        Permission.COMPLIANCE_CNDP_PURGE_EXECUTE,
      );
      expect(result.allowed).toBe(true);
    });

    it('3. broker_admin : allowed=true pour CRM_CONTACTS_CREATE (perm direct)', () => {
      const result = service.canAccess(AuthRole.BrokerAdmin, Permission.CRM_CONTACTS_CREATE);
      expect(result.allowed).toBe(true);
      expect(result.role).toBe(AuthRole.BrokerAdmin);
      expect(result.permission).toBe(Permission.CRM_CONTACTS_CREATE);
    });

    it('4. broker_user : allowed=false pour CRM_CONTACTS_DELETE (pas dans matrix)', () => {
      const result = service.canAccess(AuthRole.BrokerUser, Permission.CRM_CONTACTS_DELETE);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED);
    });

    it('5. role/permission null inputs : NO_USER_CONTEXT', () => {
      const result = service.canAccess(undefined as unknown as AuthRole, Permission.CRM_CONTACTS_READ);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(RBAC_ERROR_CODES.NO_USER_CONTEXT);
    });

    it('6. abac context fourni mais ABAC pas implemente : ABAC_DENIED placeholder', () => {
      // broker_user n'a pas crm.contacts.delete, mais avec abacContext on
      // doit avoir ABAC_DENIED au lieu de PERMISSION_NOT_GRANTED car la
      // permission existe peut-etre en variant _own.
      const result = service.canAccess(
        AuthRole.BrokerUser,
        Permission.CRM_CONTACTS_DELETE,
        { userId: 'u1', resourceOwnerId: 'u1' },
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(RBAC_ERROR_CODES.ABAC_DENIED);
    });
  });

  // ==========================================================================
  // canAccessAny -- OR logic
  // ==========================================================================

  describe('canAccessAny', () => {
    it('7. allowed=true si AU MOINS une permission accordee', () => {
      const result = service.canAccessAny(AuthRole.BrokerUser, [
        Permission.CRM_CONTACTS_DELETE, // not granted
        Permission.CRM_DEALS_CREATE, // granted
        Permission.INSURE_POLICIES_RESILIATE, // not granted
      ]);
      expect(result.allowed).toBe(true);
      expect(result.permission).toBe(Permission.CRM_DEALS_CREATE);
    });

    it('8. allowed=false si AUCUNE permission accordee', () => {
      const result = service.canAccessAny(AuthRole.BrokerAssistant, [
        Permission.INSURE_POLICIES_RESILIATE,
        Permission.BOOKS_SAFTMA_EXPORT,
      ]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED);
    });

    it('9. super_admin wildcard short-circuit', () => {
      const result = service.canAccessAny(AuthRole.SuperAdminPlatform, [
        Permission.CRM_CONTACTS_READ,
      ]);
      expect(result.allowed).toBe(true);
    });

    it('10. liste vide : NO_USER_CONTEXT', () => {
      const result = service.canAccessAny(AuthRole.BrokerUser, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(RBAC_ERROR_CODES.NO_USER_CONTEXT);
    });
  });

  // ==========================================================================
  // canAccessAll -- AND logic
  // ==========================================================================

  describe('canAccessAll', () => {
    it('11. allowed=true si TOUTES permissions accordees (broker_admin scope CRM CRUD)', () => {
      const result = service.canAccessAll(AuthRole.BrokerAdmin, [
        Permission.CRM_CONTACTS_CREATE,
        Permission.CRM_CONTACTS_UPDATE,
        Permission.CRM_CONTACTS_DELETE,
      ]);
      expect(result.allowed).toBe(true);
    });

    it('12. allowed=false si UNE SEULE permission manque', () => {
      const result = service.canAccessAll(AuthRole.BrokerUser, [
        Permission.CRM_CONTACTS_CREATE, // granted
        Permission.CRM_CONTACTS_DELETE, // NOT granted -> blocker
      ]);
      expect(result.allowed).toBe(false);
      expect(result.permission).toBe(Permission.CRM_CONTACTS_DELETE);
      expect(result.reason).toBe(RBAC_ERROR_CODES.PERMISSION_NOT_GRANTED);
    });

    it('13. super_admin wildcard short-circuit pour AND logic', () => {
      const result = service.canAccessAll(AuthRole.SuperAdminPlatform, [
        Permission.CRM_CONTACTS_CREATE,
        Permission.INSURE_POLICIES_CANCEL,
        Permission.COMPLIANCE_CNDP_PURGE_EXECUTE,
      ]);
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // canAccessAnyForRoles -- multi-role user
  // ==========================================================================

  describe('canAccessAnyForRoles', () => {
    it('14. union des permissions : allowed=true si UN role couvre', () => {
      const result = service.canAccessAnyForRoles(
        [AuthRole.BrokerAssistant, AuthRole.GarageAdmin],
        Permission.REPAIR_DEVIS_APPROVE,
      );
      // garage_admin (via garage_chef) a REPAIR_DEVIS_APPROVE
      expect(result.allowed).toBe(true);
    });

    it('15. allowed=false si aucun role ne couvre', () => {
      const result = service.canAccessAnyForRoles(
        [AuthRole.BrokerAssistant, AuthRole.Prospect],
        Permission.COMPLIANCE_CNDP_PURGE_EXECUTE,
      );
      expect(result.allowed).toBe(false);
    });

    it('16. wildcard role dans la liste : allowed=true immediat', () => {
      const result = service.canAccessAnyForRoles(
        [AuthRole.Prospect, AuthRole.SuperAdminPlatform],
        Permission.COMPLIANCE_CNDP_PURGE_EXECUTE,
      );
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // getEffectivePermissions
  // ==========================================================================

  describe('getEffectivePermissions', () => {
    it('17. super_admin retourne set contenant wildcard', () => {
      const perms = service.getEffectivePermissions(AuthRole.SuperAdminPlatform);
      expect(perms.has(RBAC_WILDCARD)).toBe(true);
      expect(perms.size).toBe(1);
    });

    it('18. broker_admin inclut direct + heritees (broker_user + broker_assistant)', () => {
      const perms = service.getEffectivePermissions(AuthRole.BrokerAdmin);
      // Direct
      expect(perms.has(Permission.CRM_CONTACTS_DELETE)).toBe(true);
      // Inherited from broker_user
      expect(perms.has(Permission.INSURE_QUOTES_GENERATE)).toBe(true);
      // Inherited from broker_assistant (via broker_user)
      expect(perms.has(Permission.BOOKING_APPOINTMENTS_CREATE)).toBe(true);
    });

    it('19. carrier_admin inherits all 5 children v3.0', () => {
      const perms = service.getEffectivePermissions(AuthRole.CarrierAdmin);
      expect(perms.has(Permission.CARRIER_PAYMENT_APPROVE_L4)).toBe(true); // from finance
      expect(perms.has(Permission.CARRIER_EXPERTS_DESIGNATE)).toBe(true); // from claims_manager
      expect(perms.has(Permission.CARRIER_FRAUD_ALERTS_READ)).toBe(true); // from compliance
      expect(perms.has(Permission.CARRIER_BROKERS_MANAGE)).toBe(true); // from partner_manager
    });

    it('20. tow_admin inherits dispatcher + driver (chain)', () => {
      const perms = service.getEffectivePermissions(AuthRole.TowAdmin);
      expect(perms.has(Permission.TOW_MISSIONS_READ_AVAILABLE)).toBe(true); // dispatcher
      expect(perms.has(Permission.TOW_VEHICLE_PHOTOS_UPLOAD)).toBe(true); // driver
    });
  });

  // ==========================================================================
  // getRolesByPermission -- inverse mapping
  // ==========================================================================

  describe('getRolesByPermission', () => {
    it('21. super_admin_platform present pour TOUTE permission (wildcard)', () => {
      const roles = service.getRolesByPermission(Permission.CRM_CONTACTS_CREATE);
      expect(roles).toContain(AuthRole.SuperAdminPlatform);
    });

    it('22. PARTS_ORDERS_CREATE : garage_parts_manager + garage_admin (via DAG)', () => {
      const roles = service.getRolesByPermission(Permission.PARTS_ORDERS_CREATE);
      expect(roles).toContain(AuthRole.GaragePartsManager);
      expect(roles).toContain(AuthRole.GarageAdmin); // herite via DAG
      expect(roles).toContain(AuthRole.SuperAdminPlatform);
    });

    it('23. EXPERTISE_HONORAIRES_INVOICE : independent + firm_admin uniquement (+ super)', () => {
      const roles = service.getRolesByPermission(Permission.EXPERTISE_HONORAIRES_INVOICE);
      expect(roles).toContain(AuthRole.ExpertIndependent);
      expect(roles).toContain(AuthRole.ExpertFirmAdmin);
      // pas expert_associate (firm_admin handles billing)
      expect(roles).not.toContain(AuthRole.ExpertAssociate);
      // pas expert_carrier_internal (salaried)
      expect(roles).not.toContain(AuthRole.ExpertCarrierInternal);
    });

    it('24. PUBLIC_PRODUCTS_READ : prospect (+ super_admin)', () => {
      const roles = service.getRolesByPermission(Permission.PUBLIC_PRODUCTS_READ);
      expect(roles).toContain(AuthRole.Prospect);
      expect(roles).toContain(AuthRole.SuperAdminPlatform);
    });
  });

  // ==========================================================================
  // clearCache
  // ==========================================================================

  describe('clearCache', () => {
    it('25. clearCache invalide la memoization in-process', () => {
      // Premier appel : memoize
      service.getEffectivePermissions(AuthRole.BrokerAdmin);
      // Clear
      service.clearCache();
      // Doit retourner meme resultat (recalcule)
      const perms = service.getEffectivePermissions(AuthRole.BrokerAdmin);
      expect(perms.has(Permission.CRM_CONTACTS_DELETE)).toBe(true);
    });
  });
});
