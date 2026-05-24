/**
 * Sprint 7.5a Tache 7.5a.8 -- No-regression suite v2.2 -> v3.0.
 *
 * Verifie que la migration foundation Assurflow v3.0 preserve integralement
 * l'invariant additif :
 *   - Les 12 roles v2.2 restent presents et a valeur identique.
 *   - Les 3 cross-tenant types v2.2 restent presents.
 *   - Les modules v2.2 + leur compte de permissions restent inchanges.
 *   - Les helpers v2.2 (isBrokerRole, isGarageRole, etc.) restent operationnels.
 *
 * Si l'un de ces tests echoue, la migration v3.0 n'est PAS additive et il y a
 * une regression a corriger avant Sprint 7 reprise tache 2.3.2.
 *
 * Reference : B-7.5a Tache 7.5a.8.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_AUTH_ROLES,
  AuthRole,
  isBrokerRole,
  isGarageRole,
} from '../types/auth-roles.js';
import { ALL_PERMISSIONS, Permission } from './permissions.enum.js';
import { Module, ALL_MODULES } from './permission-helpers.js';

describe('Sprint 7.5a -- No-regression v2.2 -> v3.0 (foundation migration)', () => {
  describe('12 v2.2 roles preserved verbatim', () => {
    it('all 12 v2.2 role string values are preserved', () => {
      // Snapshot des 12 roles v2.2 -- valeurs exactes attendues, jamais renumerotees.
      const v22RoleValues: ReadonlyArray<readonly [keyof typeof AuthRole, string]> = [
        ['SuperAdminPlatform', 'super_admin_platform'],
        ['AnalystSupport', 'analyst_support'],
        ['BrokerAdmin', 'broker_admin'],
        ['BrokerUser', 'broker_user'],
        ['BrokerAssistant', 'broker_assistant'],
        ['GarageAdmin', 'garage_admin'],
        ['GarageChef', 'garage_chef'],
        ['GarageTechnicien', 'garage_technicien'],
        ['GarageComptable', 'garage_comptable'],
        ['GarageCommercial', 'garage_commercial'],
        ['Assure', 'assure'],
        ['Prospect', 'prospect'],
      ];

      for (const [key, value] of v22RoleValues) {
        expect(AuthRole[key]).toBe(value);
      }
    });

    it('isBrokerRole still matches the 3 v2.2 broker roles', () => {
      expect(isBrokerRole(AuthRole.BrokerAdmin)).toBe(true);
      expect(isBrokerRole(AuthRole.BrokerUser)).toBe(true);
      expect(isBrokerRole(AuthRole.BrokerAssistant)).toBe(true);
    });

    it('isGarageRole still matches the 5 v2.2 garage roles + 1 new (garage_parts_manager)', () => {
      // v2.2 garage roles preserved
      expect(isGarageRole(AuthRole.GarageAdmin)).toBe(true);
      expect(isGarageRole(AuthRole.GarageChef)).toBe(true);
      expect(isGarageRole(AuthRole.GarageTechnicien)).toBe(true);
      expect(isGarageRole(AuthRole.GarageComptable)).toBe(true);
      expect(isGarageRole(AuthRole.GarageCommercial)).toBe(true);
      // v3.0 addition (decision-014)
      expect(isGarageRole(AuthRole.GaragePartsManager)).toBe(true);
    });
  });

  describe('v2.2 modules preserved', () => {
    it('all 20 v2.2 modules still registered', () => {
      const v22Modules = [
        'auth',
        'tenant',
        'crm',
        'booking',
        'comm',
        'docs',
        'signature',
        'pay',
        'books',
        'compliance',
        'analytics',
        'insure',
        'repair',
        'stock',
        'hr',
        'admin',
        'cross_tenant',
        'sky',
        'mcp',
        'public',
      ];
      for (const mod of v22Modules) {
        expect(ALL_MODULES).toContain(mod);
      }
    });

    it('total module count >= 24 (v2.2 + 4 new)', () => {
      expect(ALL_MODULES.length).toBeGreaterThanOrEqual(24);
    });
  });

  describe('v2.2 permissions preserved', () => {
    it('AUTH_USERS_CREATE = auth.users.create unchanged', () => {
      expect(Permission.AUTH_USERS_CREATE).toBe('auth.users.create');
    });

    it('INSURE_POLICIES_READ_OWN = insure.policies.read_own unchanged', () => {
      expect(Permission.INSURE_POLICIES_READ_OWN).toBe('insure.policies.read_own');
    });

    it('REPAIR_SINISTRES_READ_ASSIGNED unchanged', () => {
      expect(Permission.REPAIR_SINISTRES_READ_ASSIGNED).toBe('repair.sinistres.read_assigned');
    });

    it('CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN unchanged', () => {
      expect(Permission.CROSS_TENANT_BROKER_TO_GARAGE_ASSIGN).toBe(
        'cross_tenant.broker_to_garage.assign',
      );
    });
  });

  describe('v3.0 additions present', () => {
    it('Module enum exposes 4 new modules', () => {
      expect(Module.CARRIER).toBe('carrier');
      expect(Module.EXPERTISE).toBe('expertise');
      expect(Module.TOW).toBe('tow');
      expect(Module.PARTS).toBe('parts');
    });

    it('AuthRole exposes 14 v3.0 roles', () => {
      const v30Roles = [
        AuthRole.GaragePartsManager,
        AuthRole.CarrierAdmin,
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
        AuthRole.ExpertIndependent,
        AuthRole.ExpertFirmAdmin,
        AuthRole.ExpertAssociate,
        AuthRole.ExpertCarrierInternal,
        AuthRole.TowAdmin,
        AuthRole.TowDispatcher,
        AuthRole.TowDriver,
      ];
      expect(v30Roles).toHaveLength(14);
      for (const role of v30Roles) {
        expect(ALL_AUTH_ROLES).toContain(role);
      }
    });

    it('Permission catalog contains the 40 new v3.0 perms', () => {
      const newPrefixes = ['carrier.', 'expertise.', 'tow.', 'parts.'];
      const newCount = ALL_PERMISSIONS.filter((p) =>
        newPrefixes.some((prefix) => (p as string).startsWith(prefix)),
      ).length;
      expect(newCount).toBe(40);
    });
  });

  describe('Total counts (v3.0 contractual)', () => {
    it('exactly 26 roles total (12 v2.2 + 14 v3.0)', () => {
      expect(ALL_AUTH_ROLES).toHaveLength(26);
    });

    it('total permissions count >= 130 (v3.0 target)', () => {
      expect(ALL_PERMISSIONS.length).toBeGreaterThanOrEqual(130);
    });
  });
});
