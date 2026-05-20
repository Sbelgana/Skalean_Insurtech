/**
 * @insurtech/auth/types/auth-roles
 *
 * Defines the 12 strict roles of the Skalean InsurTech v2.2 program.
 * NEVER add a role without updating documentation/5-roles-permissions.md AND the RBAC service of Sprint 7.
 *
 * Hierarchy (from highest privilege to lowest):
 *   Platform Niveau 1     : super_admin_platform > analyst_support
 *   Tenant Broker N2      : broker_admin > broker_user > broker_assistant
 *   Tenant Garage N2      : garage_admin > garage_chef > garage_technicien (+ garage_comptable + garage_commercial as siblings)
 *   Assure N3             : assure
 *   Public                : prospect
 *
 * Reference :
 *   - 00-pilotage/documentation/5-roles-permissions.md
 *   - 00-pilotage/decisions/decision-013-rbac-roles.md
 *   - Sprint 7 RBAC implementation
 */

export enum AuthRole {
  /** Skalean platform staff -- full bypass RLS, manages all tenants */
  SuperAdminPlatform = 'super_admin_platform',
  /** Skalean platform staff -- read-only across all tenants for support N2 */
  AnalystSupport = 'analyst_support',

  /** Tenant broker -- admin of a courtage cabinet, full CRUD within tenant */
  BrokerAdmin = 'broker_admin',
  /** Tenant broker -- subscribing courtier, owns deals and policies */
  BrokerUser = 'broker_user',
  /** Tenant broker -- administrative assistant */
  BrokerAssistant = 'broker_assistant',

  /** Tenant garage -- admin of a repair garage, full CRUD within tenant */
  GarageAdmin = 'garage_admin',
  /** Tenant garage -- workshop manager, assigns sinistres */
  GarageChef = 'garage_chef',
  /** Tenant garage -- workshop technician, executes repairs (PWA mobile) */
  GarageTechnicien = 'garage_technicien',
  /** Tenant garage -- accounting staff, manages books + payments */
  GarageComptable = 'garage_comptable',
  /** Tenant garage -- commercial staff, manages devis */
  GarageCommercial = 'garage_commercial',

  /** End user -- assured client connected to assure-portal apps */
  Assure = 'assure',

  /** Public visitor -- non-authenticated or signing up */
  Prospect = 'prospect',
}

/**
 * Type guard: is this role a Platform-level role (Niveau 1)?
 * Platform roles bypass tenant isolation (no tenant_id required in JWT).
 * MUST be checked before any tenant_id comparison logic.
 */
export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

/**
 * Type guard: is this role a Tenant-level role (Niveau 2)?
 * Tenant roles require tenant_id in JWT. Operations are scoped to that tenant.
 */
export function isTenantRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant ||
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial
  );
}

/** Type guard: is this role specific to broker tenants (cabinet courtage)? */
export function isBrokerRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant
  );
}

/** Type guard: is this role specific to garage tenants? */
export function isGarageRole(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial
  );
}

/** Type guard: is this the assure (final client) role? */
export function isAssureRole(role: AuthRole): boolean {
  return role === AuthRole.Assure;
}

/** Type guard: is this the prospect (public, anonymous) role? */
export function isProspectRole(role: AuthRole): boolean {
  return role === AuthRole.Prospect;
}

/**
 * Returns the parent roles in the hierarchy.
 * broker_admin "is a" broker_user "is a" broker_assistant.
 * Used by Sprint 7 RBAC to inherit permissions from sub-roles.
 */
export function getRoleHierarchy(role: AuthRole): AuthRole[] {
  switch (role) {
    case AuthRole.BrokerAdmin:
      return [AuthRole.BrokerAdmin, AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerUser:
      return [AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerAssistant:
      return [AuthRole.BrokerAssistant];
    case AuthRole.GarageAdmin:
      return [
        AuthRole.GarageAdmin,
        AuthRole.GarageChef,
        AuthRole.GarageTechnicien,
        AuthRole.GarageComptable,
        AuthRole.GarageCommercial,
      ];
    case AuthRole.GarageChef:
      return [AuthRole.GarageChef, AuthRole.GarageTechnicien];
    case AuthRole.GarageTechnicien:
    case AuthRole.GarageComptable:
    case AuthRole.GarageCommercial:
    case AuthRole.SuperAdminPlatform:
    case AuthRole.AnalystSupport:
    case AuthRole.Assure:
    case AuthRole.Prospect:
      return [role];
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled AuthRole in getRoleHierarchy: ${String(exhaustive)}`);
    }
  }
}

/**
 * Whether MFA is mandatory for this role.
 * super_admin_platform and analyst_support MUST have MFA enabled at signup.
 * broker_admin and garage_admin MUST have MFA enabled when they create their tenant (Sprint 6).
 */
export function isMfaMandatory(role: AuthRole): boolean {
  return (
    role === AuthRole.SuperAdminPlatform ||
    role === AuthRole.AnalystSupport ||
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.GarageAdmin
  );
}

/**
 * Whether WebAuthn / Passkey biometric login is preferred for this role (Sprint 23).
 * garage_technicien works on PWA mobile in workshop environment without keyboard.
 */
export function prefersWebAuthn(role: AuthRole): boolean {
  return role === AuthRole.GarageTechnicien;
}

/** All AuthRole values as a frozen array (for iteration in tests, validators, etc.) */
export const ALL_AUTH_ROLES: readonly AuthRole[] = Object.freeze([
  AuthRole.SuperAdminPlatform,
  AuthRole.AnalystSupport,
  AuthRole.BrokerAdmin,
  AuthRole.BrokerUser,
  AuthRole.BrokerAssistant,
  AuthRole.GarageAdmin,
  AuthRole.GarageChef,
  AuthRole.GarageTechnicien,
  AuthRole.GarageComptable,
  AuthRole.GarageCommercial,
  AuthRole.Assure,
  AuthRole.Prospect,
]);
