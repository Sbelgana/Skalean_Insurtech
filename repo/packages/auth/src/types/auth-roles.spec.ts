/**
 * Tests AuthRole enum + helpers (Sprint 7.5a Foundation Migration v3.0).
 *
 * Validates :
 *   - 26 roles total (12 v2.2 + 14 v3.0).
 *   - Helpers isCarrierRole / isExpertRole / isTowRole.
 *   - Mutual exclusivity of tenant type guards.
 *   - getRoleHierarchy() exhaustivity.
 *   - ALL_AUTH_ROLES coverage.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_AUTH_ROLES,
  AuthRole,
  getRoleHierarchy,
  isAssureRole,
  isBrokerRole,
  isCarrierRole,
  isExpertRole,
  isGarageRole,
  isMfaMandatory,
  isPlatformRole,
  isProspectRole,
  isTenantRole,
  isTowRole,
  prefersWebAuthn,
} from './auth-roles.js';

describe('AuthRole enum (v3.0 -- Sprint 7.5a)', () => {
  it('contains exactly 26 roles', () => {
    expect(Object.keys(AuthRole)).toHaveLength(26);
    expect(ALL_AUTH_ROLES).toHaveLength(26);
  });

  it('preserves the 12 v2.2 role values verbatim', () => {
    expect(AuthRole.SuperAdminPlatform).toBe('super_admin_platform');
    expect(AuthRole.AnalystSupport).toBe('analyst_support');
    expect(AuthRole.BrokerAdmin).toBe('broker_admin');
    expect(AuthRole.BrokerUser).toBe('broker_user');
    expect(AuthRole.BrokerAssistant).toBe('broker_assistant');
    expect(AuthRole.GarageAdmin).toBe('garage_admin');
    expect(AuthRole.GarageChef).toBe('garage_chef');
    expect(AuthRole.GarageTechnicien).toBe('garage_technicien');
    expect(AuthRole.GarageComptable).toBe('garage_comptable');
    expect(AuthRole.GarageCommercial).toBe('garage_commercial');
    expect(AuthRole.Assure).toBe('assure');
    expect(AuthRole.Prospect).toBe('prospect');
  });

  it('adds 6 carrier roles (decision-012)', () => {
    expect(AuthRole.CarrierAdmin).toBe('carrier_admin');
    expect(AuthRole.CarrierClaimsManager).toBe('carrier_claims_manager');
    expect(AuthRole.CarrierFinance).toBe('carrier_finance');
    expect(AuthRole.CarrierCompliance).toBe('carrier_compliance');
    expect(AuthRole.CarrierExpertManager).toBe('carrier_expert_manager');
    expect(AuthRole.CarrierPartnerManager).toBe('carrier_partner_manager');
  });

  it('adds 4 expert roles (decision-013)', () => {
    expect(AuthRole.ExpertIndependent).toBe('expert_independent');
    expect(AuthRole.ExpertFirmAdmin).toBe('expert_firm_admin');
    expect(AuthRole.ExpertAssociate).toBe('expert_associate');
    expect(AuthRole.ExpertCarrierInternal).toBe('expert_carrier_internal');
  });

  it('adds 3 tow roles (decision-012)', () => {
    expect(AuthRole.TowAdmin).toBe('tow_admin');
    expect(AuthRole.TowDispatcher).toBe('tow_dispatcher');
    expect(AuthRole.TowDriver).toBe('tow_driver');
  });

  it('adds 1 garage_parts_manager (decision-014 PartsHub)', () => {
    expect(AuthRole.GaragePartsManager).toBe('garage_parts_manager');
  });
});

describe('Tenant type guards (mutual exclusivity)', () => {
  it('isPlatformRole matches only 2 roles', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isPlatformRole(r));
    expect(matches).toEqual([AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport]);
  });

  it('isBrokerRole matches exactly 3 roles', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isBrokerRole(r));
    expect(matches).toHaveLength(3);
    expect(matches).toContain(AuthRole.BrokerAdmin);
    expect(matches).toContain(AuthRole.BrokerUser);
    expect(matches).toContain(AuthRole.BrokerAssistant);
  });

  it('isGarageRole matches 6 roles including garage_parts_manager (v3.0)', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isGarageRole(r));
    expect(matches).toHaveLength(6);
    expect(matches).toContain(AuthRole.GaragePartsManager);
  });

  it('isCarrierRole matches exactly 6 roles (v3.0)', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isCarrierRole(r));
    expect(matches).toHaveLength(6);
  });

  it('isExpertRole matches exactly 4 roles (v3.0)', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isExpertRole(r));
    expect(matches).toHaveLength(4);
  });

  it('isTowRole matches exactly 3 roles (v3.0)', () => {
    const matches = ALL_AUTH_ROLES.filter((r) => isTowRole(r));
    expect(matches).toHaveLength(3);
  });

  it('mutual exclusivity : a role belongs to exactly one tenant-type group (excluding platform + L3 + public)', () => {
    for (const role of ALL_AUTH_ROLES) {
      const groups = [
        isPlatformRole(role),
        isBrokerRole(role),
        isGarageRole(role),
        isCarrierRole(role),
        isExpertRole(role),
        isTowRole(role),
        isAssureRole(role),
        isProspectRole(role),
      ].filter(Boolean);
      expect(groups, `role ${role} must belong to exactly one group`).toHaveLength(1);
    }
  });

  it('isTenantRole is the union of broker + garage + carrier + expert + tow', () => {
    const tenantCount = ALL_AUTH_ROLES.filter((r) => isTenantRole(r)).length;
    const sum =
      ALL_AUTH_ROLES.filter((r) => isBrokerRole(r)).length +
      ALL_AUTH_ROLES.filter((r) => isGarageRole(r)).length +
      ALL_AUTH_ROLES.filter((r) => isCarrierRole(r)).length +
      ALL_AUTH_ROLES.filter((r) => isExpertRole(r)).length +
      ALL_AUTH_ROLES.filter((r) => isTowRole(r)).length;
    expect(tenantCount).toBe(sum);
    expect(tenantCount).toBe(3 + 6 + 6 + 4 + 3);
  });
});

describe('getRoleHierarchy (v3.0 extension)', () => {
  it('returns role itself for terminal roles', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAssistant)).toEqual([AuthRole.BrokerAssistant]);
    expect(getRoleHierarchy(AuthRole.GarageTechnicien)).toEqual([AuthRole.GarageTechnicien]);
    expect(getRoleHierarchy(AuthRole.Assure)).toEqual([AuthRole.Assure]);
    expect(getRoleHierarchy(AuthRole.Prospect)).toEqual([AuthRole.Prospect]);
  });

  it('returns full chain for broker_admin', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAdmin)).toEqual([
      AuthRole.BrokerAdmin,
      AuthRole.BrokerUser,
      AuthRole.BrokerAssistant,
    ]);
  });

  it('returns full DAG for garage_admin including parts_manager', () => {
    const result = getRoleHierarchy(AuthRole.GarageAdmin);
    expect(result).toContain(AuthRole.GarageAdmin);
    expect(result).toContain(AuthRole.GaragePartsManager);
    expect(result).toHaveLength(6);
  });

  it('returns carrier_admin DAG with 6 entries (admin + 5 children)', () => {
    const result = getRoleHierarchy(AuthRole.CarrierAdmin);
    expect(result).toHaveLength(6);
    expect(result).toContain(AuthRole.CarrierAdmin);
    expect(result).toContain(AuthRole.CarrierClaimsManager);
    expect(result).toContain(AuthRole.CarrierFinance);
    expect(result).toContain(AuthRole.CarrierCompliance);
    expect(result).toContain(AuthRole.CarrierExpertManager);
    expect(result).toContain(AuthRole.CarrierPartnerManager);
  });

  it('returns expert_firm_admin -> expert_associate chain', () => {
    expect(getRoleHierarchy(AuthRole.ExpertFirmAdmin)).toEqual([
      AuthRole.ExpertFirmAdmin,
      AuthRole.ExpertAssociate,
    ]);
  });

  it('expert_independent and expert_carrier_internal are terminal', () => {
    expect(getRoleHierarchy(AuthRole.ExpertIndependent)).toEqual([AuthRole.ExpertIndependent]);
    expect(getRoleHierarchy(AuthRole.ExpertCarrierInternal)).toEqual([AuthRole.ExpertCarrierInternal]);
  });

  it('returns tow_admin chain : admin -> dispatcher -> driver', () => {
    expect(getRoleHierarchy(AuthRole.TowAdmin)).toEqual([
      AuthRole.TowAdmin,
      AuthRole.TowDispatcher,
      AuthRole.TowDriver,
    ]);
  });
});

describe('isMfaMandatory (v3.0 extension)', () => {
  it('platform staff always require MFA', () => {
    expect(isMfaMandatory(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isMfaMandatory(AuthRole.AnalystSupport)).toBe(true);
  });

  it('all tenant admins require MFA', () => {
    expect(isMfaMandatory(AuthRole.BrokerAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.GarageAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.CarrierAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.ExpertFirmAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.ExpertIndependent)).toBe(true);
    expect(isMfaMandatory(AuthRole.TowAdmin)).toBe(true);
  });

  it('non-admin roles do not require MFA by default', () => {
    expect(isMfaMandatory(AuthRole.BrokerUser)).toBe(false);
    expect(isMfaMandatory(AuthRole.GarageTechnicien)).toBe(false);
    expect(isMfaMandatory(AuthRole.TowDriver)).toBe(false);
    expect(isMfaMandatory(AuthRole.Assure)).toBe(false);
  });
});

describe('prefersWebAuthn (v3.0 extension)', () => {
  it('garage_technicien prefers WebAuthn (PWA mobile, no keyboard)', () => {
    expect(prefersWebAuthn(AuthRole.GarageTechnicien)).toBe(true);
  });

  it('tow_driver prefers WebAuthn (PWA mobile field)', () => {
    expect(prefersWebAuthn(AuthRole.TowDriver)).toBe(true);
  });

  it('desk roles do not prefer WebAuthn', () => {
    expect(prefersWebAuthn(AuthRole.BrokerAdmin)).toBe(false);
    expect(prefersWebAuthn(AuthRole.CarrierClaimsManager)).toBe(false);
  });
});
