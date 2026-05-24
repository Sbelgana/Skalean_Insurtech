/**
 * Sprint 7 Tache 2.3.12 -- Seed dev 26 RBAC users.
 *
 * Cree 1 user par role applicatif (26 total) pour faciliter dev/tests :
 *   - 1 super_admin_platform : super-admin@demo.assurflow.ma
 *   - 1 analyst_support
 *   - 3 broker users
 *   - 6 garage users (incluant garage_parts_manager v3.0)
 *   - 6 carrier users (v3.0 decision-012)
 *   - 4 expert users (v3.0 decision-013)
 *   - 3 tow users (v3.0 decision-012)
 *   - 1 assure
 *   - 1 prospect (no tenant)
 *
 * Password : Test1234!@#$ (jamais prod).
 * MFA disabled (faciliter tests).
 *
 * Usage :
 *   pnpm tsx infrastructure/scripts/seed-rbac-users.ts
 *
 * Reference : B-07 Tache 2.3.12 + decision-012/013/014.
 *
 * NOTE : ce script est un placeholder pour faciliter le pilote Marrakech.
 * L'implementation complete (INSERT auth_users + auth_tenant_users via
 * DataSource) sera finalisee dans Sprint 8 quand les seeds tenants
 * (3 tenants demo : broker / garage / carrier) seront fixes.
 */

import { ALL_AUTH_ROLES, AuthRole } from '@insurtech/auth';

export interface SeedUserBlueprint {
  readonly role: AuthRole;
  readonly email: string;
  readonly displayName: string;
  readonly tenantSlug: string | null;
  readonly tenantTypeHint: string;
}

const DEMO_PASSWORD = 'Test1234!@#$';

export const SEED_USERS: readonly SeedUserBlueprint[] = [
  // Platform (2)
  {
    role: AuthRole.SuperAdminPlatform,
    email: 'super-admin@demo.assurflow.ma',
    displayName: 'Super Admin Skalean',
    tenantSlug: null,
    tenantTypeHint: 'platform',
  },
  {
    role: AuthRole.AnalystSupport,
    email: 'analyst-support@demo.assurflow.ma',
    displayName: 'Analyst Skalean',
    tenantSlug: null,
    tenantTypeHint: 'platform',
  },

  // Broker (3)
  {
    role: AuthRole.BrokerAdmin,
    email: 'broker-admin@demo-bennani.assurflow.ma',
    displayName: 'Admin Cabinet Bennani',
    tenantSlug: 'cabinet-bennani-demo',
    tenantTypeHint: 'broker',
  },
  {
    role: AuthRole.BrokerUser,
    email: 'broker-user@demo-bennani.assurflow.ma',
    displayName: 'Courtier Bennani',
    tenantSlug: 'cabinet-bennani-demo',
    tenantTypeHint: 'broker',
  },
  {
    role: AuthRole.BrokerAssistant,
    email: 'broker-assistant@demo-bennani.assurflow.ma',
    displayName: 'Assistant Bennani',
    tenantSlug: 'cabinet-bennani-demo',
    tenantTypeHint: 'broker',
  },

  // Garage (6 -- v3.0 incluant parts_manager)
  {
    role: AuthRole.GarageAdmin,
    email: 'garage-admin@demo-atlas.assurflow.ma',
    displayName: 'Admin Garage Atlas',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },
  {
    role: AuthRole.GarageChef,
    email: 'garage-chef@demo-atlas.assurflow.ma',
    displayName: 'Chef Atelier Atlas',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },
  {
    role: AuthRole.GarageTechnicien,
    email: 'garage-tech@demo-atlas.assurflow.ma',
    displayName: 'Technicien Atlas',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },
  {
    role: AuthRole.GarageComptable,
    email: 'garage-compta@demo-atlas.assurflow.ma',
    displayName: 'Comptable Atlas',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },
  {
    role: AuthRole.GarageCommercial,
    email: 'garage-commercial@demo-atlas.assurflow.ma',
    displayName: 'Commercial Atlas',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },
  {
    role: AuthRole.GaragePartsManager,
    email: 'garage-parts@demo-atlas.assurflow.ma',
    displayName: 'Responsable Pieces Atlas (PartsHub)',
    tenantSlug: 'garage-atlas-demo',
    tenantTypeHint: 'garage',
  },

  // Carrier (6 -- v3.0)
  {
    role: AuthRole.CarrierAdmin,
    email: 'carrier-admin@demo-wafa.assurflow.ma',
    displayName: 'Admin Wafa Assurance',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },
  {
    role: AuthRole.CarrierClaimsManager,
    email: 'carrier-claims@demo-wafa.assurflow.ma',
    displayName: 'Manager Sinistres Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },
  {
    role: AuthRole.CarrierFinance,
    email: 'carrier-finance@demo-wafa.assurflow.ma',
    displayName: 'Finance Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },
  {
    role: AuthRole.CarrierCompliance,
    email: 'carrier-compliance@demo-wafa.assurflow.ma',
    displayName: 'Compliance Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },
  {
    role: AuthRole.CarrierExpertManager,
    email: 'carrier-expert-mgr@demo-wafa.assurflow.ma',
    displayName: 'Manager Pool Experts Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },
  {
    role: AuthRole.CarrierPartnerManager,
    email: 'carrier-partner-mgr@demo-wafa.assurflow.ma',
    displayName: 'Manager Partenaires Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'carrier',
  },

  // Expert (4 -- v3.0, decision-013)
  {
    role: AuthRole.ExpertIndependent,
    email: 'expert-independent@demo.assurflow.ma',
    displayName: 'Expert Independant (ACAPS)',
    tenantSlug: 'expert-independent-demo',
    tenantTypeHint: 'expert',
  },
  {
    role: AuthRole.ExpertFirmAdmin,
    email: 'expert-firm-admin@demo-cabinet.assurflow.ma',
    displayName: 'Admin Cabinet Expertise',
    tenantSlug: 'cabinet-expertise-demo',
    tenantTypeHint: 'expert',
  },
  {
    role: AuthRole.ExpertAssociate,
    email: 'expert-associate@demo-cabinet.assurflow.ma',
    displayName: 'Associe Cabinet Expertise',
    tenantSlug: 'cabinet-expertise-demo',
    tenantTypeHint: 'expert',
  },
  {
    role: AuthRole.ExpertCarrierInternal,
    email: 'expert-internal@demo-wafa.assurflow.ma',
    displayName: 'Expert Interne Wafa',
    tenantSlug: 'wafa-assurance-demo',
    tenantTypeHint: 'expert',
  },

  // Tow (3 -- v3.0, decision-012)
  {
    role: AuthRole.TowAdmin,
    email: 'tow-admin@demo-remorquage.assurflow.ma',
    displayName: 'Admin Remorquage Atlas',
    tenantSlug: 'tow-atlas-demo',
    tenantTypeHint: 'tow',
  },
  {
    role: AuthRole.TowDispatcher,
    email: 'tow-dispatcher@demo-remorquage.assurflow.ma',
    displayName: 'Dispatcher Remorquage Atlas',
    tenantSlug: 'tow-atlas-demo',
    tenantTypeHint: 'tow',
  },
  {
    role: AuthRole.TowDriver,
    email: 'tow-driver@demo-remorquage.assurflow.ma',
    displayName: 'Conducteur Remorquage Atlas',
    tenantSlug: 'tow-atlas-demo',
    tenantTypeHint: 'tow',
  },

  // L3 + Public (2)
  {
    role: AuthRole.Assure,
    email: 'assure@demo.assurflow.ma',
    displayName: 'Assure Demo',
    tenantSlug: 'cabinet-bennani-demo', // rattache courtier
    tenantTypeHint: 'l3',
  },
  {
    role: AuthRole.Prospect,
    email: 'prospect@demo.assurflow.ma',
    displayName: 'Prospect Demo',
    tenantSlug: null,
    tenantTypeHint: 'public',
  },
];

/**
 * Verifie que le seed couvre TOUS les 26 roles v3.0.
 * Sanity guard appele au boot du seed pour eviter divergence catalog/seed.
 */
export function validateSeedCoverage(): {
  ok: boolean;
  missingRoles: readonly AuthRole[];
} {
  const seeded = new Set(SEED_USERS.map((u) => u.role));
  const missing = ALL_AUTH_ROLES.filter((r) => !seeded.has(r));
  return {
    ok: missing.length === 0,
    missingRoles: missing,
  };
}

export { DEMO_PASSWORD };

// CLI entrypoint (executed via tsx) -- placeholder pour Sprint 8 integration DB
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('seed-rbac-users.ts')) {
  const result = validateSeedCoverage();
  console.log(
    JSON.stringify(
      {
        action: 'seed_rbac_users_validation',
        ok: result.ok,
        totalUsers: SEED_USERS.length,
        missingRoles: result.missingRoles,
      },
      null,
      2,
    ),
  );
  if (!result.ok) {
    console.error('SEED COVERAGE INCOMPLETE -- abort');
    process.exit(1);
  }
}
