/**
 * Tests seed RBAC users -- Sprint 7 Tache 2.3.12.
 *
 * Verifie que le seed couvre les 26 roles v3.0 sans doublon ni miss.
 */

import { ALL_AUTH_ROLES, AuthRole } from '@insurtech/auth';
import { describe, expect, it } from 'vitest';
import { SEED_USERS, validateSeedCoverage } from '../seed-rbac-users.js';

describe('Seed RBAC users coverage (Sprint 7 Tache 2.3.12)', () => {
  it('1. 26 users seedes (1 par role v3.0)', () => {
    expect(SEED_USERS).toHaveLength(26);
    expect(SEED_USERS).toHaveLength(ALL_AUTH_ROLES.length);
  });

  it('2. coverage complete : aucun role manquant', () => {
    const result = validateSeedCoverage();
    expect(result.ok).toBe(true);
    expect(result.missingRoles).toHaveLength(0);
  });

  it('3. emails uniques', () => {
    const emails = SEED_USERS.map((u) => u.email);
    const set = new Set(emails);
    expect(set.size).toBe(emails.length);
  });

  it('4. roles uniques (1 user par role)', () => {
    const roles = SEED_USERS.map((u) => u.role);
    const set = new Set(roles);
    expect(set.size).toBe(roles.length);
  });

  it('5. v3.0 nouveaux roles tous representes', () => {
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
    const seeded = new Set(SEED_USERS.map((u) => u.role));
    for (const role of v30Roles) {
      expect(seeded.has(role)).toBe(true);
    }
  });

  it('6. platform users : tenantSlug null', () => {
    const platformUsers = SEED_USERS.filter(
      (u) => u.role === AuthRole.SuperAdminPlatform || u.role === AuthRole.AnalystSupport,
    );
    for (const u of platformUsers) {
      expect(u.tenantSlug).toBeNull();
    }
  });

  it('7. prospect : tenantSlug null', () => {
    const prospect = SEED_USERS.find((u) => u.role === AuthRole.Prospect);
    expect(prospect?.tenantSlug).toBeNull();
  });

  it('8. assure : rattache courtier (tenantSlug non-null)', () => {
    const assure = SEED_USERS.find((u) => u.role === AuthRole.Assure);
    expect(assure?.tenantSlug).toBeTruthy();
  });

  it('9. domain emails assurflow.ma (rebrand decision-011)', () => {
    for (const u of SEED_USERS) {
      expect(u.email).toMatch(/@.+\.assurflow\.ma$/);
    }
  });

  it('10. expert_carrier_internal rattache au tenant carrier', () => {
    const ec = SEED_USERS.find((u) => u.role === AuthRole.ExpertCarrierInternal);
    // tenantSlug pointe vers le carrier (Wafa demo) car expert salaried interne
    expect(ec?.tenantSlug).toContain('wafa');
  });
});
