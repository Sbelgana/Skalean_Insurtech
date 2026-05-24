/**
 * Sprint 7 Tache 2.3.2 -- Tests PermissionsMatrix v3.0 (14 nouveaux roles populated).
 *
 * Valide :
 *   - Chacun des 14 nouveaux roles a une entree non-vide dans la matrice.
 *   - Le compte de permissions directes par role respecte les targets decision-012/013/014.
 *   - L'heritage via HierarchyResolver fonctionne pour les 3 admin roles v3.0
 *     (carrier_admin, expert_firm_admin, tow_admin).
 *   - Pas de cross-domain inheritance.
 *   - Validator boot-time PASS (validatePermissionsMatrix).
 */

import { describe, expect, it } from 'vitest';
import { AuthRole } from '../types/auth-roles.js';
import { HierarchyResolver } from './hierarchy-resolver.js';
import { validatePermissionsMatrix } from './matrix-validator.js';
import {
  PermissionsMatrix,
  countDirectPermissions,
} from './permissions-matrix.js';
import { Permission } from './permissions.enum.js';

describe('PermissionsMatrix v3.0 -- 14 new roles populated (Sprint 7 task 2.3.2)', () => {
  describe('Direct permissions present (non-empty entries)', () => {
    const v30Roles: ReadonlyArray<readonly [AuthRole, number]> = [
      [AuthRole.GaragePartsManager, 7], // 7 parts perms minimum
      [AuthRole.CarrierAdmin, 10],
      [AuthRole.CarrierClaimsManager, 5],
      [AuthRole.CarrierFinance, 6],
      [AuthRole.CarrierCompliance, 6],
      [AuthRole.CarrierExpertManager, 3],
      [AuthRole.CarrierPartnerManager, 3],
      [AuthRole.ExpertIndependent, 10],
      [AuthRole.ExpertFirmAdmin, 5],
      [AuthRole.ExpertAssociate, 8],
      [AuthRole.ExpertCarrierInternal, 8],
      [AuthRole.TowAdmin, 5],
      [AuthRole.TowDispatcher, 3],
      [AuthRole.TowDriver, 6],
    ];

    for (const [role, minPerms] of v30Roles) {
      it(`${role} has >= ${minPerms} direct permissions`, () => {
        expect(countDirectPermissions(role)).toBeGreaterThanOrEqual(minPerms);
      });
    }
  });

  describe('Module-specific permissions present', () => {
    it('garage_parts_manager has all 7 PARTS_* permissions (decision-014)', () => {
      const entry = PermissionsMatrix[AuthRole.GaragePartsManager] as readonly string[];
      expect(entry).toContain(Permission.PARTS_SUPPLIERS_READ);
      expect(entry).toContain(Permission.PARTS_SUPPLIERS_ADD_FAVORITE);
      expect(entry).toContain(Permission.PARTS_ORDERS_CREATE);
      expect(entry).toContain(Permission.PARTS_ORDERS_READ);
      expect(entry).toContain(Permission.PARTS_ORDERS_CANCEL);
      expect(entry).toContain(Permission.PARTS_COMMISSION_VIEW);
      expect(entry).toContain(Permission.PARTS_INVOICES_READ);
    });

    it('carrier_finance has 4 payment approval levels + reject', () => {
      const entry = PermissionsMatrix[AuthRole.CarrierFinance] as readonly string[];
      expect(entry).toContain(Permission.CARRIER_PAYMENT_APPROVE_L1);
      expect(entry).toContain(Permission.CARRIER_PAYMENT_APPROVE_L2);
      expect(entry).toContain(Permission.CARRIER_PAYMENT_APPROVE_L3);
      expect(entry).toContain(Permission.CARRIER_PAYMENT_APPROVE_L4);
      expect(entry).toContain(Permission.CARRIER_PAYMENT_REJECT);
    });

    it('carrier_claims_manager can designate + read expert pool', () => {
      const entry = PermissionsMatrix[AuthRole.CarrierClaimsManager] as readonly string[];
      expect(entry).toContain(Permission.CARRIER_EXPERTS_DESIGNATE);
      expect(entry).toContain(Permission.CARRIER_EXPERTS_READ_POOL);
      expect(entry).toContain(Permission.CARRIER_CLAIMS_READ_ALL);
    });

    it('carrier_compliance has ACAPS + AML compliance permissions', () => {
      const entry = PermissionsMatrix[AuthRole.CarrierCompliance] as readonly string[];
      expect(entry).toContain(Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE);
      expect(entry).toContain(Permission.CARRIER_FRAUD_ALERTS_READ);
      expect(entry).toContain(Permission.COMPLIANCE_ACAPS_REPORTS_GENERATE);
      expect(entry).toContain(Permission.COMPLIANCE_AML_ALERTS_REVIEW);
    });

    it('expert_independent has full quote validation workflow', () => {
      const entry = PermissionsMatrix[AuthRole.ExpertIndependent] as readonly string[];
      expect(entry).toContain(Permission.EXPERTISE_VALIDATE_QUOTE);
      expect(entry).toContain(Permission.EXPERTISE_MODIFY_QUOTE);
      expect(entry).toContain(Permission.EXPERTISE_REJECT_QUOTE);
      expect(entry).toContain(Permission.EXPERTISE_REPORT_SIGN);
      expect(entry).toContain(Permission.EXPERTISE_HONORAIRES_INVOICE);
    });

    it('expert_associate excludes honoraires invoice (firm_admin handles it)', () => {
      const entry = PermissionsMatrix[AuthRole.ExpertAssociate] as readonly string[];
      expect(entry).not.toContain(Permission.EXPERTISE_HONORAIRES_INVOICE);
      expect(entry).toContain(Permission.EXPERTISE_VALIDATE_QUOTE);
    });

    it('expert_carrier_internal excludes honoraires invoice (salaried)', () => {
      const entry = PermissionsMatrix[AuthRole.ExpertCarrierInternal] as readonly string[];
      expect(entry).not.toContain(Permission.EXPERTISE_HONORAIRES_INVOICE);
      // Has carrier-scope policies read
      expect(entry).toContain(Permission.INSURE_POLICIES_READ_ALL);
    });

    it('tow_driver has mission lifecycle + photos + availability', () => {
      const entry = PermissionsMatrix[AuthRole.TowDriver] as readonly string[];
      expect(entry).toContain(Permission.TOW_MISSIONS_ACCEPT);
      expect(entry).toContain(Permission.TOW_MISSIONS_REJECT);
      expect(entry).toContain(Permission.TOW_MISSIONS_COMPLETE);
      expect(entry).toContain(Permission.TOW_VEHICLE_PHOTOS_UPLOAD);
      expect(entry).toContain(Permission.TOW_AVAILABILITY_TOGGLE);
    });

    it('tow_admin has drivers manage + earnings', () => {
      const entry = PermissionsMatrix[AuthRole.TowAdmin] as readonly string[];
      expect(entry).toContain(Permission.TOW_DRIVERS_MANAGE);
      expect(entry).toContain(Permission.TOW_EARNINGS_READ);
      expect(entry).toContain(Permission.TENANT_USERS_INVITE);
    });
  });

  describe('Inheritance via HierarchyResolver', () => {
    const resolver = new HierarchyResolver();

    it('carrier_admin inherits all 5 children (claims/finance/compliance/expert_manager/partner_manager)', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.CarrierAdmin);
      // Inherits carrier_claims_manager perms
      expect(effective.has(Permission.CARRIER_CLAIMS_READ_ALL)).toBe(true);
      expect(effective.has(Permission.CARRIER_EXPERTS_DESIGNATE)).toBe(true);
      // Inherits carrier_finance perms
      expect(effective.has(Permission.CARRIER_PAYMENT_APPROVE_L4)).toBe(true);
      expect(effective.has(Permission.CARRIER_PAYMENT_REJECT)).toBe(true);
      // Inherits carrier_compliance perms
      expect(effective.has(Permission.CARRIER_FRAUD_ALERTS_READ)).toBe(true);
      expect(effective.has(Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE)).toBe(true);
      // Inherits carrier_expert_manager perms
      expect(effective.has(Permission.CARRIER_EXPERTS_EVALUATE)).toBe(true);
      // Inherits carrier_partner_manager perms
      expect(effective.has(Permission.CARRIER_PARTNERS_READ_STATS)).toBe(true);
      expect(effective.has(Permission.CARRIER_BROKERS_MANAGE)).toBe(true);
      // Has its own direct
      expect(effective.has(Permission.TENANT_SETTINGS_UPDATE)).toBe(true);
    });

    it('expert_firm_admin inherits expert_associate execute permissions', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.ExpertFirmAdmin);
      // From own direct
      expect(effective.has(Permission.EXPERTISE_HONORAIRES_INVOICE)).toBe(true);
      expect(effective.has(Permission.TENANT_USERS_INVITE)).toBe(true);
      // Inherited from expert_associate
      expect(effective.has(Permission.EXPERTISE_VALIDATE_QUOTE)).toBe(true);
      expect(effective.has(Permission.EXPERTISE_REPORT_CREATE)).toBe(true);
    });

    it('tow_admin inherits tow_dispatcher AND tow_driver (chain admin -> dispatcher -> driver)', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.TowAdmin);
      // Direct
      expect(effective.has(Permission.TOW_DRIVERS_MANAGE)).toBe(true);
      // From tow_dispatcher
      expect(effective.has(Permission.TOW_MISSIONS_READ_AVAILABLE)).toBe(true);
      // From tow_driver (transitively via dispatcher)
      expect(effective.has(Permission.TOW_MISSIONS_ACCEPT)).toBe(true);
      expect(effective.has(Permission.TOW_VEHICLE_PHOTOS_UPLOAD)).toBe(true);
      expect(effective.has(Permission.TOW_AVAILABILITY_TOGGLE)).toBe(true);
    });

    it('garage_admin inherits garage_parts_manager (PartsHub v3.0)', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.GarageAdmin);
      // Garage admin should now inherit parts perms via DAG
      expect(effective.has(Permission.PARTS_ORDERS_CREATE)).toBe(true);
      expect(effective.has(Permission.PARTS_COMMISSION_VIEW)).toBe(true);
    });

    it('expert_independent has its own perms (terminal, no inheritance)', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.ExpertIndependent);
      // Has expertise.honoraires.invoice (terminal role, doesn't share)
      expect(effective.has(Permission.EXPERTISE_HONORAIRES_INVOICE)).toBe(true);
      // Does NOT have firm_admin tenant management
      expect(effective.has(Permission.TENANT_USERS_INVITE)).toBe(false);
    });
  });

  describe('Boot-time validator passes with v3.0 matrix populated', () => {
    it('validatePermissionsMatrix returns valid=true', () => {
      const result = validatePermissionsMatrix();
      if (!result.valid) {
        console.error('Validator errors:', result.errors);
      }
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });

    it('stats include 26 totalRoles + 1 wildcard + avg > 0', () => {
      const result = validatePermissionsMatrix();
      expect(result.stats.totalRoles).toBe(26);
      expect(result.stats.rolesWithWildcard).toBe(1);
      expect(result.stats.avgPermissionsPerRole).toBeGreaterThan(0);
    });
  });

  describe('No cross-domain inheritance (broker/garage/carrier/expert/tow isolated)', () => {
    const resolver = new HierarchyResolver();

    it('carrier_admin does NOT inherit broker permissions', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.CarrierAdmin);
      expect(effective.has(Permission.CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN)).toBe(false);
    });

    it('expert_firm_admin does NOT inherit carrier permissions', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.ExpertFirmAdmin);
      expect(effective.has(Permission.CARRIER_PAYMENT_APPROVE_L1)).toBe(false);
    });

    it('tow_admin does NOT inherit garage permissions', () => {
      const effective = resolver.getEffectivePermissions(AuthRole.TowAdmin);
      expect(effective.has(Permission.REPAIR_DEVIS_APPROVE)).toBe(false);
    });
  });
});
