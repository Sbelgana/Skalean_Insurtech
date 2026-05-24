/**
 * Sprint 7 Tache 2.3.12 -- Tests RBAC exhaustifs role x permission matrix.
 *
 * Pour chaque role v3.0, verifie au moins une permission representative
 * "doit etre accordee" et une "doit etre refusee". Couvre les 26 roles + 4
 * domaines ABAC policies (own / time / status / workflow).
 *
 * Plus 80+ scenarios cumules entre :
 *   - tests permissions-matrix-v3.spec.ts (33)
 *   - tests rbac.service.spec.ts (25)
 *   - tests permission.guard.spec.ts (15)
 *   - tests role.guard.spec.ts (23)
 *   - tests abac.service.spec.ts (35)
 *   - tests abac.guard.spec.ts (15)
 *   - tests rbac-audit.service.spec.ts (10)
 *   - tests permission-cache.service.spec.ts (14)
 *   - tests admin-permissions.service.spec.ts (16)
 *   - tests permissions-catalog.spec.ts (24)
 *
 * Cette suite ajoute le coverage role-perm representatif pour validation V-07.
 *
 * Reference : B-07 Tache 2.3.12.
 */

import {
  AuthRole,
  HierarchyResolver,
  Permission,
  RbacService,
} from '@insurtech/auth';
import { describe, expect, it } from 'vitest';

const rbac = new RbacService(new HierarchyResolver());

/**
 * Matrice representative : 1+ permission accordee + 1+ refusee par role v3.0.
 * Couvre les 4 domaines metier (CRM / Insure / Repair / Compliance) + nouvelles
 * verticales v3.0 (Carrier / Expert / Tow / Parts).
 */
const ROLE_COVERAGE: ReadonlyArray<{
  role: AuthRole;
  shouldAllow: readonly string[];
  shouldDeny: readonly string[];
}> = [
  // Platform
  {
    role: AuthRole.SuperAdminPlatform,
    shouldAllow: [
      Permission.CRM_CONTACTS_CREATE,
      Permission.INSURE_POLICIES_CANCEL,
      Permission.COMPLIANCE_CNDP_PURGE_EXECUTE,
      Permission.PARTS_ORDERS_CREATE,
      Permission.EXPERTISE_HONORAIRES_INVOICE,
    ],
    shouldDeny: [], // wildcard, never deny
  },
  {
    role: AuthRole.AnalystSupport,
    shouldAllow: [Permission.ADMIN_TENANTS_LIST, Permission.ADMIN_AUDIT_READ],
    shouldDeny: [Permission.ADMIN_TENANTS_PURGE, Permission.ADMIN_IMPERSONATE_USER],
  },

  // Broker
  {
    role: AuthRole.BrokerAdmin,
    shouldAllow: [
      Permission.CRM_CONTACTS_DELETE,
      Permission.INSURE_POLICIES_CREATE,
      Permission.TENANT_USERS_INVITE,
    ],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.CARRIER_PAYMENT_APPROVE_L4],
  },
  {
    role: AuthRole.BrokerUser,
    shouldAllow: [Permission.CRM_DEALS_CREATE, Permission.INSURE_QUOTES_GENERATE],
    shouldDeny: [Permission.CRM_CONTACTS_DELETE, Permission.AUTH_USERS_CREATE],
  },
  {
    role: AuthRole.BrokerAssistant,
    shouldAllow: [Permission.BOOKING_APPOINTMENTS_CREATE, Permission.COMM_MESSAGES_SEND],
    shouldDeny: [Permission.INSURE_POLICIES_CREATE, Permission.CRM_CONTACTS_DELETE],
  },

  // Garage (v2.2 + v3.0 PartsManager)
  {
    role: AuthRole.GarageAdmin,
    shouldAllow: [
      Permission.REPAIR_DEVIS_APPROVE,
      Permission.PARTS_ORDERS_CREATE, // v3.0 via DAG
      Permission.HR_EMPLOYEES_MANAGE,
    ],
    shouldDeny: [Permission.INSURE_POLICIES_CREATE, Permission.CARRIER_BROKERS_MANAGE],
  },
  {
    role: AuthRole.GarageChef,
    shouldAllow: [Permission.REPAIR_DEVIS_APPROVE, Permission.REPAIR_SINISTRES_ASSIGN],
    shouldDeny: [Permission.PARTS_ORDERS_CREATE, Permission.AUTH_USERS_CREATE],
  },
  {
    role: AuthRole.GarageTechnicien,
    shouldAllow: [
      Permission.REPAIR_REPARATIONS_START,
      Permission.REPAIR_SINISTRES_READ_ASSIGNED,
    ],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.PARTS_ORDERS_CREATE],
  },
  {
    role: AuthRole.GaragePartsManager,
    shouldAllow: [
      Permission.PARTS_ORDERS_CREATE,
      Permission.PARTS_COMMISSION_VIEW,
      Permission.PARTS_INVOICES_READ,
    ],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.AUTH_USERS_CREATE],
  },
  {
    role: AuthRole.GarageComptable,
    shouldAllow: [Permission.BOOKS_INVOICES_CREATE, Permission.PAY_TRANSACTIONS_RECONCILE],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.PARTS_ORDERS_CREATE],
  },
  {
    role: AuthRole.GarageCommercial,
    shouldAllow: [Permission.REPAIR_DEVIS_CREATE, Permission.CRM_CONTACTS_CREATE],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.AUTH_USERS_CREATE],
  },

  // Carrier (v3.0)
  {
    role: AuthRole.CarrierAdmin,
    shouldAllow: [
      Permission.CARRIER_PAYMENT_APPROVE_L4,
      Permission.CARRIER_EXPERTS_DESIGNATE,
      Permission.CARRIER_BROKERS_MANAGE,
    ],
    shouldDeny: [Permission.REPAIR_DEVIS_APPROVE, Permission.CRM_CONTACTS_DELETE],
  },
  {
    role: AuthRole.CarrierClaimsManager,
    shouldAllow: [Permission.CARRIER_EXPERTS_DESIGNATE, Permission.CARRIER_CLAIMS_READ_ALL],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L4, Permission.TENANT_USERS_INVITE],
  },
  {
    role: AuthRole.CarrierFinance,
    shouldAllow: [Permission.CARRIER_PAYMENT_APPROVE_L1, Permission.CARRIER_PAYMENT_REJECT],
    shouldDeny: [
      Permission.CARRIER_EXPERTS_DESIGNATE,
      Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE,
    ],
  },
  {
    role: AuthRole.CarrierCompliance,
    shouldAllow: [
      Permission.CARRIER_COMPLIANCE_REPORTS_GENERATE,
      Permission.COMPLIANCE_AML_ALERTS_REVIEW,
    ],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L1, Permission.AUTH_USERS_CREATE],
  },
  {
    role: AuthRole.CarrierExpertManager,
    shouldAllow: [Permission.CARRIER_EXPERTS_EVALUATE],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L1, Permission.CRM_CONTACTS_DELETE],
  },
  {
    role: AuthRole.CarrierPartnerManager,
    shouldAllow: [Permission.CARRIER_PARTNERS_READ_STATS, Permission.CARRIER_BROKERS_MANAGE],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L1, Permission.CARRIER_EXPERTS_DESIGNATE],
  },

  // Expert (v3.0)
  {
    role: AuthRole.ExpertIndependent,
    shouldAllow: [
      Permission.EXPERTISE_VALIDATE_QUOTE,
      Permission.EXPERTISE_REPORT_SIGN,
      Permission.EXPERTISE_HONORAIRES_INVOICE,
    ],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L1, Permission.TENANT_USERS_INVITE],
  },
  {
    role: AuthRole.ExpertFirmAdmin,
    shouldAllow: [Permission.EXPERTISE_HONORAIRES_INVOICE, Permission.TENANT_USERS_INVITE],
    shouldDeny: [Permission.CARRIER_PAYMENT_APPROVE_L1],
  },
  {
    role: AuthRole.ExpertAssociate,
    shouldAllow: [Permission.EXPERTISE_VALIDATE_QUOTE, Permission.EXPERTISE_REPORT_CREATE],
    shouldDeny: [
      Permission.EXPERTISE_HONORAIRES_INVOICE, // firm_admin handles
      Permission.TENANT_USERS_INVITE,
    ],
  },
  {
    role: AuthRole.ExpertCarrierInternal,
    shouldAllow: [Permission.EXPERTISE_VALIDATE_QUOTE, Permission.INSURE_POLICIES_READ_ALL],
    shouldDeny: [
      Permission.EXPERTISE_HONORAIRES_INVOICE, // salaried
      Permission.CARRIER_PAYMENT_APPROVE_L1,
    ],
  },

  // Tow (v3.0)
  {
    role: AuthRole.TowAdmin,
    shouldAllow: [
      Permission.TOW_DRIVERS_MANAGE,
      Permission.TOW_MISSIONS_ACCEPT, // via driver via dispatcher
      Permission.TOW_VEHICLE_PHOTOS_UPLOAD, // via driver
    ],
    shouldDeny: [Permission.CRM_CONTACTS_DELETE, Permission.CARRIER_PAYMENT_APPROVE_L1],
  },
  {
    role: AuthRole.TowDispatcher,
    shouldAllow: [
      Permission.TOW_MISSIONS_READ_AVAILABLE,
      Permission.TOW_MISSIONS_ACCEPT, // inherits driver
    ],
    shouldDeny: [Permission.TOW_DRIVERS_MANAGE, Permission.AUTH_USERS_CREATE],
  },
  {
    role: AuthRole.TowDriver,
    shouldAllow: [
      Permission.TOW_MISSIONS_ACCEPT,
      Permission.TOW_VEHICLE_PHOTOS_UPLOAD,
      Permission.TOW_AVAILABILITY_TOGGLE,
    ],
    shouldDeny: [Permission.TOW_DRIVERS_MANAGE, Permission.AUTH_USERS_CREATE],
  },

  // Assure + Prospect
  {
    role: AuthRole.Assure,
    shouldAllow: [
      Permission.INSURE_POLICIES_READ_OWN,
      Permission.REPAIR_SINISTRES_CREATE_OWN,
    ],
    shouldDeny: [Permission.INSURE_POLICIES_CREATE, Permission.CRM_CONTACTS_READ],
  },
  {
    role: AuthRole.Prospect,
    shouldAllow: [Permission.PUBLIC_PRODUCTS_READ, Permission.PUBLIC_QUOTES_GENERATE],
    shouldDeny: [Permission.INSURE_POLICIES_READ_OWN, Permission.CRM_CONTACTS_READ],
  },
];

describe('RBAC role x permission coverage (Sprint 7 Tache 2.3.12)', () => {
  for (const entry of ROLE_COVERAGE) {
    describe(`role=${entry.role}`, () => {
      for (const perm of entry.shouldAllow) {
        it(`allows ${perm}`, () => {
          const result = rbac.canAccess(entry.role, perm as never);
          if (!result.allowed) {
            console.error(`UNEXPECTED DENY for role=${entry.role} perm=${perm}:`, result);
          }
          expect(result.allowed).toBe(true);
        });
      }
      for (const perm of entry.shouldDeny) {
        it(`denies ${perm}`, () => {
          const result = rbac.canAccess(entry.role, perm as never);
          if (result.allowed) {
            console.error(`UNEXPECTED ALLOW for role=${entry.role} perm=${perm}:`, result);
          }
          expect(result.allowed).toBe(false);
        });
      }
    });
  }

  it('coverage stats : 26 roles tested + 100+ scenarios', () => {
    expect(ROLE_COVERAGE).toHaveLength(26);
    let totalScenarios = 0;
    for (const entry of ROLE_COVERAGE) {
      totalScenarios += entry.shouldAllow.length + entry.shouldDeny.length;
    }
    expect(totalScenarios).toBeGreaterThanOrEqual(80);
  });
});
