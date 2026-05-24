/**
 * Tests for @insurtech/auth/types/auth-roles
 * Sprint 5 Tache 2.1.1
 * Aucune emoji (decision-006).
 */

import { describe, it, expect } from 'vitest';
import {
  AuthRole,
  isPlatformRole,
  isTenantRole,
  isBrokerRole,
  isGarageRole,
  isAssureRole,
  isProspectRole,
  getRoleHierarchy,
  isMfaMandatory,
  prefersWebAuthn,
  ALL_AUTH_ROLES,
} from '../../src/types/auth-roles.js';

describe('AuthRole enum', () => {
  it('should declare exactly 26 roles (v3.0 Sprint 7.5a Foundation)', () => {
    expect(Object.keys(AuthRole)).toHaveLength(26);
    expect(ALL_AUTH_ROLES).toHaveLength(26);
  });

  it('should have stable string values for each role', () => {
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

  it('should expose all roles via ALL_AUTH_ROLES frozen array', () => {
    expect(Object.isFrozen(ALL_AUTH_ROLES)).toBe(true);
  });
});

describe('isPlatformRole', () => {
  it('returns true for super_admin_platform and analyst_support only', () => {
    expect(isPlatformRole(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isPlatformRole(AuthRole.AnalystSupport)).toBe(true);
  });

  it('returns false for tenant, assure, and prospect roles', () => {
    expect(isPlatformRole(AuthRole.BrokerAdmin)).toBe(false);
    expect(isPlatformRole(AuthRole.GarageTechnicien)).toBe(false);
    expect(isPlatformRole(AuthRole.Assure)).toBe(false);
    expect(isPlatformRole(AuthRole.Prospect)).toBe(false);
  });
});

describe('isTenantRole', () => {
  it('returns true for broker and garage roles', () => {
    expect(isTenantRole(AuthRole.BrokerAdmin)).toBe(true);
    expect(isTenantRole(AuthRole.BrokerUser)).toBe(true);
    expect(isTenantRole(AuthRole.BrokerAssistant)).toBe(true);
    expect(isTenantRole(AuthRole.GarageAdmin)).toBe(true);
    expect(isTenantRole(AuthRole.GarageChef)).toBe(true);
    expect(isTenantRole(AuthRole.GarageTechnicien)).toBe(true);
    expect(isTenantRole(AuthRole.GarageComptable)).toBe(true);
    expect(isTenantRole(AuthRole.GarageCommercial)).toBe(true);
  });

  it('returns false for platform, assure, prospect', () => {
    expect(isTenantRole(AuthRole.SuperAdminPlatform)).toBe(false);
    expect(isTenantRole(AuthRole.AnalystSupport)).toBe(false);
    expect(isTenantRole(AuthRole.Assure)).toBe(false);
    expect(isTenantRole(AuthRole.Prospect)).toBe(false);
  });
});

describe('isBrokerRole', () => {
  it('returns true only for the 3 broker roles', () => {
    expect(isBrokerRole(AuthRole.BrokerAdmin)).toBe(true);
    expect(isBrokerRole(AuthRole.BrokerUser)).toBe(true);
    expect(isBrokerRole(AuthRole.BrokerAssistant)).toBe(true);
  });

  it('returns false for garage roles', () => {
    expect(isBrokerRole(AuthRole.GarageAdmin)).toBe(false);
    expect(isBrokerRole(AuthRole.GarageChef)).toBe(false);
  });
});

describe('isGarageRole', () => {
  it('returns true for the 5 garage roles', () => {
    expect(isGarageRole(AuthRole.GarageAdmin)).toBe(true);
    expect(isGarageRole(AuthRole.GarageChef)).toBe(true);
    expect(isGarageRole(AuthRole.GarageTechnicien)).toBe(true);
    expect(isGarageRole(AuthRole.GarageComptable)).toBe(true);
    expect(isGarageRole(AuthRole.GarageCommercial)).toBe(true);
  });

  it('returns false for broker roles', () => {
    expect(isGarageRole(AuthRole.BrokerAdmin)).toBe(false);
  });
});

describe('isAssureRole and isProspectRole', () => {
  it('isAssureRole only true for assure', () => {
    expect(isAssureRole(AuthRole.Assure)).toBe(true);
    expect(isAssureRole(AuthRole.Prospect)).toBe(false);
    expect(isAssureRole(AuthRole.BrokerUser)).toBe(false);
  });

  it('isProspectRole only true for prospect', () => {
    expect(isProspectRole(AuthRole.Prospect)).toBe(true);
    expect(isProspectRole(AuthRole.Assure)).toBe(false);
  });
});

describe('getRoleHierarchy', () => {
  it('broker_admin includes itself, broker_user, broker_assistant', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAdmin)).toEqual([
      AuthRole.BrokerAdmin,
      AuthRole.BrokerUser,
      AuthRole.BrokerAssistant,
    ]);
  });

  it('broker_user includes itself and broker_assistant', () => {
    expect(getRoleHierarchy(AuthRole.BrokerUser)).toEqual([
      AuthRole.BrokerUser,
      AuthRole.BrokerAssistant,
    ]);
  });

  it('broker_assistant returns just itself', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAssistant)).toEqual([AuthRole.BrokerAssistant]);
  });

  it('garage_admin includes 6 garage roles (v3.0 : +garage_parts_manager)', () => {
    const h = getRoleHierarchy(AuthRole.GarageAdmin);
    expect(h).toContain(AuthRole.GarageAdmin);
    expect(h).toContain(AuthRole.GarageChef);
    expect(h).toContain(AuthRole.GarageTechnicien);
    expect(h).toContain(AuthRole.GarageComptable);
    expect(h).toContain(AuthRole.GarageCommercial);
    expect(h).toContain(AuthRole.GaragePartsManager);
    expect(h).toHaveLength(6);
  });

  it('garage_chef includes itself and technicien', () => {
    expect(getRoleHierarchy(AuthRole.GarageChef)).toEqual([
      AuthRole.GarageChef,
      AuthRole.GarageTechnicien,
    ]);
  });

  it('atomic roles return only themselves', () => {
    expect(getRoleHierarchy(AuthRole.SuperAdminPlatform)).toEqual([AuthRole.SuperAdminPlatform]);
    expect(getRoleHierarchy(AuthRole.AnalystSupport)).toEqual([AuthRole.AnalystSupport]);
    expect(getRoleHierarchy(AuthRole.Assure)).toEqual([AuthRole.Assure]);
    expect(getRoleHierarchy(AuthRole.Prospect)).toEqual([AuthRole.Prospect]);
    expect(getRoleHierarchy(AuthRole.GarageTechnicien)).toEqual([AuthRole.GarageTechnicien]);
    expect(getRoleHierarchy(AuthRole.GarageComptable)).toEqual([AuthRole.GarageComptable]);
    expect(getRoleHierarchy(AuthRole.GarageCommercial)).toEqual([AuthRole.GarageCommercial]);
  });

  it('throws on invalid role', () => {
    expect(() => getRoleHierarchy('not_a_role' as AuthRole)).toThrow(/Unhandled AuthRole/);
  });
});

describe('isMfaMandatory', () => {
  it('returns true for super_admin_platform, analyst_support, broker_admin, garage_admin', () => {
    expect(isMfaMandatory(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isMfaMandatory(AuthRole.AnalystSupport)).toBe(true);
    expect(isMfaMandatory(AuthRole.BrokerAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.GarageAdmin)).toBe(true);
  });

  it('returns false for non-admin roles', () => {
    expect(isMfaMandatory(AuthRole.BrokerUser)).toBe(false);
    expect(isMfaMandatory(AuthRole.GarageTechnicien)).toBe(false);
    expect(isMfaMandatory(AuthRole.Assure)).toBe(false);
    expect(isMfaMandatory(AuthRole.Prospect)).toBe(false);
  });
});

describe('prefersWebAuthn', () => {
  it('returns true only for garage_technicien', () => {
    expect(prefersWebAuthn(AuthRole.GarageTechnicien)).toBe(true);
    expect(prefersWebAuthn(AuthRole.GarageChef)).toBe(false);
    expect(prefersWebAuthn(AuthRole.BrokerAdmin)).toBe(false);
  });
});
