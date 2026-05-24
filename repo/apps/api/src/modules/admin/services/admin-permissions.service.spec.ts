/**
 * Tests AdminPermissionsService -- Sprint 7 Tache 2.3.11.
 */

import {
  AuthRole,
  HierarchyResolver,
  Permission,
  RbacService,
} from '@insurtech/auth';
import { describe, expect, it } from 'vitest';
import { AdminPermissionsService } from './admin-permissions.service.js';

function build(): AdminPermissionsService {
  return new AdminPermissionsService(new RbacService(new HierarchyResolver()));
}

describe('AdminPermissionsService (Sprint 7 Tache 2.3.11)', () => {
  describe('listRoles', () => {
    it('1. retourne 26 roles avec metadata', () => {
      const service = build();
      const roles = service.listRoles();
      expect(roles).toHaveLength(26);
    });

    it('2. super_admin_platform has wildcard + effectivePermissionsCount=-1', () => {
      const service = build();
      const roles = service.listRoles();
      const sa = roles.find((r) => r.role === AuthRole.SuperAdminPlatform);
      expect(sa?.hasWildcard).toBe(true);
      expect(sa?.effectivePermissionsCount).toBe(-1);
      expect(sa?.tenantType).toBe('platform');
    });

    it('3. broker_admin has hierarchy children + count > direct', () => {
      const service = build();
      const roles = service.listRoles();
      const ba = roles.find((r) => r.role === AuthRole.BrokerAdmin);
      expect(ba?.directChildren).toContain(AuthRole.BrokerUser);
      expect(ba?.effectivePermissionsCount).toBeGreaterThan(ba?.directPermissionsCount ?? 0);
    });

    it('4. v3.0 roles : carrier_admin / expert_independent / tow_admin / garage_parts_manager presents', () => {
      const service = build();
      const roles = service.listRoles();
      expect(roles.find((r) => r.role === AuthRole.CarrierAdmin)).toBeDefined();
      expect(roles.find((r) => r.role === AuthRole.ExpertIndependent)).toBeDefined();
      expect(roles.find((r) => r.role === AuthRole.TowAdmin)).toBeDefined();
      expect(roles.find((r) => r.role === AuthRole.GaragePartsManager)).toBeDefined();
    });

    it('5. tenantType v3.0 : carrier / expert / tow correctement detecte', () => {
      const service = build();
      const roles = service.listRoles();
      expect(roles.find((r) => r.role === AuthRole.CarrierAdmin)?.tenantType).toBe('carrier');
      expect(roles.find((r) => r.role === AuthRole.ExpertIndependent)?.tenantType).toBe('expert');
      expect(roles.find((r) => r.role === AuthRole.TowDriver)?.tenantType).toBe('tow');
    });
  });

  describe('getRoleDetail', () => {
    it('6. broker_admin inclut directPermissions + inherited from broker_user/broker_assistant', () => {
      const service = build();
      const detail = service.getRoleDetail(AuthRole.BrokerAdmin);
      expect(detail.role).toBe(AuthRole.BrokerAdmin);
      expect(detail.directPermissions.length).toBeGreaterThan(0);
      const inheritedRoles = detail.inheritedFrom.map((i) => i.role);
      expect(inheritedRoles).toContain(AuthRole.BrokerUser);
      expect(inheritedRoles).toContain(AuthRole.BrokerAssistant);
    });

    it('7. carrier_admin inherits 5 children (v3.0 DAG)', () => {
      const service = build();
      const detail = service.getRoleDetail(AuthRole.CarrierAdmin);
      const inheritedRoles = detail.inheritedFrom.map((i) => i.role);
      expect(inheritedRoles).toContain(AuthRole.CarrierClaimsManager);
      expect(inheritedRoles).toContain(AuthRole.CarrierFinance);
      expect(inheritedRoles).toContain(AuthRole.CarrierCompliance);
      expect(inheritedRoles).toContain(AuthRole.CarrierExpertManager);
      expect(inheritedRoles).toContain(AuthRole.CarrierPartnerManager);
    });

    it('8. expert_independent terminal : aucun inheritance', () => {
      const service = build();
      const detail = service.getRoleDetail(AuthRole.ExpertIndependent);
      expect(detail.inheritedFrom).toEqual([]);
    });

    it('9. effectivePermissions contient permissions directes + inherited', () => {
      const service = build();
      const detail = service.getRoleDetail(AuthRole.TowAdmin);
      // direct
      expect(detail.effectivePermissions).toContain(Permission.TOW_DRIVERS_MANAGE);
      // inherited from tow_driver via tow_dispatcher
      expect(detail.effectivePermissions).toContain(Permission.TOW_MISSIONS_ACCEPT);
    });
  });

  describe('getPermissionsCatalog', () => {
    it('10. totalCount >= 130 (v3.0 target)', () => {
      const service = build();
      const cat = service.getPermissionsCatalog();
      expect(cat.totalCount).toBeGreaterThanOrEqual(130);
    });

    it('11. modules v3.0 (carrier/expertise/tow/parts) presents', () => {
      const service = build();
      const cat = service.getPermissionsCatalog();
      expect(cat.modules).toContain('carrier');
      expect(cat.modules).toContain('expertise');
      expect(cat.modules).toContain('tow');
      expect(cat.modules).toContain('parts');
    });

    it('12. byModule.parts contient 7 perms', () => {
      const service = build();
      const cat = service.getPermissionsCatalog();
      expect(cat.byModule['parts']).toHaveLength(7);
    });

    it('13. byModule.carrier contient 15 perms', () => {
      const service = build();
      const cat = service.getPermissionsCatalog();
      expect(cat.byModule['carrier']).toHaveLength(15);
    });
  });

  describe('getRolesByPermission', () => {
    it('14. EXPERTISE_VALIDATE_QUOTE : expert_independent + expert_associate + expert_carrier_internal (+ ancestors)', () => {
      const service = build();
      const roles = service.getRolesByPermission(Permission.EXPERTISE_VALIDATE_QUOTE);
      expect(roles).toContain(AuthRole.ExpertIndependent);
      expect(roles).toContain(AuthRole.ExpertAssociate);
      expect(roles).toContain(AuthRole.ExpertCarrierInternal);
      // expert_firm_admin via DAG (parent of expert_associate)
      expect(roles).toContain(AuthRole.ExpertFirmAdmin);
      // super_admin via wildcard
      expect(roles).toContain(AuthRole.SuperAdminPlatform);
    });

    it('15. PARTS_ORDERS_CREATE : garage_parts_manager + garage_admin (DAG)', () => {
      const service = build();
      const roles = service.getRolesByPermission(Permission.PARTS_ORDERS_CREATE);
      expect(roles).toContain(AuthRole.GaragePartsManager);
      expect(roles).toContain(AuthRole.GarageAdmin);
    });
  });

  describe('clearLocalCache', () => {
    it('16. clearLocalCache returns {cleared: true}', () => {
      const service = build();
      const result = service.clearLocalCache();
      expect(result.cleared).toBe(true);
    });
  });
});
