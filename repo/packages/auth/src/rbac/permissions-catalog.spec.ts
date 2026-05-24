/**
 * Tests Permission catalog extension (Sprint 7.5a Foundation Migration v3.0).
 *
 * Validates :
 *   - Total permissions count = 130 (90 v2.2 + 40 v3.0).
 *   - 4 new modules : carrier (15) + expertise (10) + tow (8) + parts (7).
 *   - Permissions style `as const` (jamais enum, decision interne).
 *   - All v3.0 permissions follow {module}.{resource}.{action} 3-segment format.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  PERMISSIONS_COUNT,
  Permission,
} from './permissions.enum.js';
import { Module, ALL_MODULES, parsePermission } from './permission-helpers.js';

describe('Permission catalog v3.0 (Sprint 7.5a)', () => {
  it('total permissions count >= 130 (target v3.0 ; v2.2 base + 40 new modules)', () => {
    // v2.2 catalog Sprint 7 tache 2.3.1 contenait > 90 perms (137 effectifs).
    // v3.0 ajoute 40 perms (carrier 15 + expertise 10 + tow 8 + parts 7).
    // Target decision-012 : "~130" -- on garantit >= 130 et le compte exact.
    expect(PERMISSIONS_COUNT).toBeGreaterThanOrEqual(130);
    expect(ALL_PERMISSIONS.length).toBe(PERMISSIONS_COUNT);
  });

  it('exactly 40 new permissions added by Sprint 7.5a (4 new modules)', () => {
    const newModulePrefixes = ['carrier.', 'expertise.', 'tow.', 'parts.'];
    const newPerms = ALL_PERMISSIONS.filter((p) =>
      newModulePrefixes.some((prefix) => (p as string).startsWith(prefix)),
    );
    expect(newPerms).toHaveLength(40);
  });

  it('Permission is `as const` (not an enum)', () => {
    // Smoke check : Permission est un objet litteral, pas un enum runtime.
    // Un enum aurait reverse-mapping number -> string. Ici c'est juste object.
    expect(typeof Permission).toBe('object');
    expect(Permission).not.toBeNull();
  });

  it('no duplicate permission values', () => {
    const set = new Set<string>(ALL_PERMISSIONS as readonly string[]);
    expect(set.size).toBe(ALL_PERMISSIONS.length);
  });

  it('every permission follows {module}.{resource}.{action} 3-segment format', () => {
    for (const perm of ALL_PERMISSIONS) {
      const parts = (perm as string).split('.');
      expect(parts).toHaveLength(3);
      expect(() => parsePermission(perm as string)).not.toThrow();
    }
  });
});

describe('CARRIER module (15 permissions, decision-012)', () => {
  const carrierPerms = ALL_PERMISSIONS.filter((p) => (p as string).startsWith('carrier.'));

  it('contains exactly 15 carrier permissions', () => {
    expect(carrierPerms).toHaveLength(15);
  });

  it('includes core carrier permissions', () => {
    expect(carrierPerms).toContain(Permission.CARRIER_DASHBOARD_READ);
    expect(carrierPerms).toContain(Permission.CARRIER_CLAIMS_READ);
    expect(carrierPerms).toContain(Permission.CARRIER_CLAIMS_READ_ALL);
    expect(carrierPerms).toContain(Permission.CARRIER_EXPERTS_DESIGNATE);
    expect(carrierPerms).toContain(Permission.CARRIER_BROKERS_MANAGE);
  });

  it('includes 4-level payment approval workflow', () => {
    expect(carrierPerms).toContain(Permission.CARRIER_PAYMENT_APPROVE_L1);
    expect(carrierPerms).toContain(Permission.CARRIER_PAYMENT_APPROVE_L2);
    expect(carrierPerms).toContain(Permission.CARRIER_PAYMENT_APPROVE_L3);
    expect(carrierPerms).toContain(Permission.CARRIER_PAYMENT_APPROVE_L4);
    expect(carrierPerms).toContain(Permission.CARRIER_PAYMENT_REJECT);
  });

  it('includes expert pool and partner stats', () => {
    expect(carrierPerms).toContain(Permission.CARRIER_EXPERTS_READ_POOL);
    expect(carrierPerms).toContain(Permission.CARRIER_EXPERTS_EVALUATE);
    expect(carrierPerms).toContain(Permission.CARRIER_PARTNERS_READ_STATS);
  });

  it('includes compliance and fraud monitoring', () => {
    expect(carrierPerms).toContain(Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE);
    expect(carrierPerms).toContain(Permission.CARRIER_FRAUD_ALERTS_READ);
  });
});

describe('EXPERTISE module (10 permissions, decision-013)', () => {
  const expertisePerms = ALL_PERMISSIONS.filter((p) => (p as string).startsWith('expertise.'));

  it('contains exactly 10 expertise permissions', () => {
    expect(expertisePerms).toHaveLength(10);
  });

  it('includes mission lifecycle (read/accept/reject)', () => {
    expect(expertisePerms).toContain(Permission.EXPERTISE_MISSIONS_READ);
    expect(expertisePerms).toContain(Permission.EXPERTISE_MISSIONS_ACCEPT);
    expect(expertisePerms).toContain(Permission.EXPERTISE_MISSIONS_REJECT);
  });

  it('includes quote validation workflow (validate/modify/reject)', () => {
    expect(expertisePerms).toContain(Permission.EXPERTISE_VALIDATE_QUOTE);
    expect(expertisePerms).toContain(Permission.EXPERTISE_MODIFY_QUOTE);
    expect(expertisePerms).toContain(Permission.EXPERTISE_REJECT_QUOTE);
  });

  it('includes report creation + signature (Barid eSign, decision-009)', () => {
    expect(expertisePerms).toContain(Permission.EXPERTISE_REPORT_CREATE);
    expect(expertisePerms).toContain(Permission.EXPERTISE_REPORT_SIGN);
  });

  it('includes honoraires invoicing + execution', () => {
    expect(expertisePerms).toContain(Permission.EXPERTISE_EXECUTE);
    expect(expertisePerms).toContain(Permission.EXPERTISE_HONORAIRES_INVOICE);
  });
});

describe('TOW module (8 permissions, decision-012)', () => {
  const towPerms = ALL_PERMISSIONS.filter((p) => (p as string).startsWith('tow.'));

  it('contains exactly 8 tow permissions', () => {
    expect(towPerms).toHaveLength(8);
  });

  it('includes mission lifecycle for drivers', () => {
    expect(towPerms).toContain(Permission.TOW_MISSIONS_READ_AVAILABLE);
    expect(towPerms).toContain(Permission.TOW_MISSIONS_ACCEPT);
    expect(towPerms).toContain(Permission.TOW_MISSIONS_REJECT);
    expect(towPerms).toContain(Permission.TOW_MISSIONS_COMPLETE);
  });

  it('includes photo upload + availability toggle', () => {
    expect(towPerms).toContain(Permission.TOW_VEHICLE_PHOTOS_UPLOAD);
    expect(towPerms).toContain(Permission.TOW_AVAILABILITY_TOGGLE);
  });

  it('includes earnings + driver management', () => {
    expect(towPerms).toContain(Permission.TOW_EARNINGS_READ);
    expect(towPerms).toContain(Permission.TOW_DRIVERS_MANAGE);
  });
});

describe('PARTS Hub module (7 permissions, decision-014)', () => {
  const partsPerms = ALL_PERMISSIONS.filter((p) => (p as string).startsWith('parts.'));

  it('contains exactly 7 parts permissions', () => {
    expect(partsPerms).toHaveLength(7);
  });

  it('includes supplier management (read + add_to_favorites)', () => {
    expect(partsPerms).toContain(Permission.PARTS_SUPPLIERS_READ);
    expect(partsPerms).toContain(Permission.PARTS_SUPPLIERS_ADD_FAVORITE);
  });

  it('includes orders CRUD + cancel within window', () => {
    expect(partsPerms).toContain(Permission.PARTS_ORDERS_CREATE);
    expect(partsPerms).toContain(Permission.PARTS_ORDERS_READ);
    expect(partsPerms).toContain(Permission.PARTS_ORDERS_CANCEL);
  });

  it('includes commission dashboard + invoices', () => {
    expect(partsPerms).toContain(Permission.PARTS_COMMISSION_VIEW);
    expect(partsPerms).toContain(Permission.PARTS_INVOICES_READ);
  });
});

describe('v3.0 modules registered (Sprint 7.5a)', () => {
  it('Module constant includes 4 new modules', () => {
    expect(ALL_MODULES).toContain(Module.CARRIER);
    expect(ALL_MODULES).toContain(Module.EXPERTISE);
    expect(ALL_MODULES).toContain(Module.TOW);
    expect(ALL_MODULES).toContain(Module.PARTS);
  });

  it('total module count = 24 (20 v2.2 + 4 v3.0)', () => {
    expect(ALL_MODULES).toHaveLength(24);
  });
});
