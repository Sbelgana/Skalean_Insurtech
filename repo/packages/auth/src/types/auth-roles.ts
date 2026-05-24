/**
 * @insurtech/auth/types/auth-roles
 *
 * Defines the 26 strict roles of the Assurflow v3.0 program (Sprint 7.5a Foundation Migration).
 *
 * History :
 *   - v2.2 (12 roles) : broker (3), garage (5), platform (2), assure, prospect.
 *   - v3.0 (26 roles, Sprint 7.5a) : v2.2 + carrier (6) + expert (4) + tow (3) + garage_parts_manager (1).
 *
 * NEVER add a role without updating documentation/5-roles-permissions.md AND the RBAC service of Sprint 7.
 *
 * Hierarchy (from highest privilege to lowest) :
 *   Platform Niveau 1     : super_admin_platform > analyst_support
 *   Tenant Broker N2      : broker_admin > broker_user > broker_assistant
 *   Tenant Garage N2      : garage_admin > garage_chef > garage_technicien
 *                           (+ garage_comptable + garage_commercial + garage_parts_manager as siblings)
 *   Tenant Carrier N2     : carrier_admin > carrier_claims_manager / carrier_finance / carrier_compliance /
 *                           carrier_expert_manager / carrier_partner_manager
 *   Tenant Expert N2      : expert_firm_admin > expert_associate ; expert_independent (standalone) ;
 *                           expert_carrier_internal (carrier-scoped)
 *   Tenant Tow N2         : tow_admin > tow_dispatcher > tow_driver
 *   Assure N3             : assure
 *   Public                : prospect
 *
 * Reference :
 *   - 00-pilotage/documentation/5-roles-permissions.md (v3.0)
 *   - 00-pilotage/decisions/012-ecosysteme-6-acteurs.md
 *   - 00-pilotage/decisions/013-expert-acteur-central.md
 *   - 00-pilotage/decisions/014-partshub-module-garage.md
 *   - Sprint 7 RBAC implementation, Sprint 7.5a Foundation Migration
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
  /** Tenant garage -- parts manager (PartsHub module, decision-014) */
  GaragePartsManager = 'garage_parts_manager',

  /** Tenant carrier -- admin of an insurance company, full CRUD within tenant */
  CarrierAdmin = 'carrier_admin',
  /** Tenant carrier -- claims management lead (designates experts, approves payouts) */
  CarrierClaimsManager = 'carrier_claims_manager',
  /** Tenant carrier -- finance role, payment approval workflow */
  CarrierFinance = 'carrier_finance',
  /** Tenant carrier -- compliance / ACAPS reporting */
  CarrierCompliance = 'carrier_compliance',
  /** Tenant carrier -- manages the expert pool (designation, evaluation) */
  CarrierExpertManager = 'carrier_expert_manager',
  /** Tenant carrier -- manages broker / garage partner network */
  CarrierPartnerManager = 'carrier_partner_manager',

  /** Tenant expert -- independent expert (ACAPS-licensed, standalone) */
  ExpertIndependent = 'expert_independent',
  /** Tenant expert -- admin of an expert firm (multi-associate) */
  ExpertFirmAdmin = 'expert_firm_admin',
  /** Tenant expert -- associate inside an expert firm */
  ExpertAssociate = 'expert_associate',
  /** Tenant expert -- internal expert employed by a carrier */
  ExpertCarrierInternal = 'expert_carrier_internal',

  /** Tenant tow -- admin of a tow operator */
  TowAdmin = 'tow_admin',
  /** Tenant tow -- dispatcher (assigns missions to drivers) */
  TowDispatcher = 'tow_dispatcher',
  /** Tenant tow -- driver executing tow missions */
  TowDriver = 'tow_driver',

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
    isBrokerRole(role) ||
    isGarageRole(role) ||
    isCarrierRole(role) ||
    isExpertRole(role) ||
    isTowRole(role)
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

/** Type guard: is this role specific to garage tenants (includes PartsHub manager)? */
export function isGarageRole(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial ||
    role === AuthRole.GaragePartsManager
  );
}

/** Type guard: is this role specific to carrier tenants (insurance companies)? */
export function isCarrierRole(role: AuthRole): boolean {
  return (
    role === AuthRole.CarrierAdmin ||
    role === AuthRole.CarrierClaimsManager ||
    role === AuthRole.CarrierFinance ||
    role === AuthRole.CarrierCompliance ||
    role === AuthRole.CarrierExpertManager ||
    role === AuthRole.CarrierPartnerManager
  );
}

/**
 * Type guard: is this role specific to expert tenants (ACAPS-licensed experts)?
 * Per decision-013, experts MUST be in their own tenant (or carrier tenant for internals),
 * never in a garage tenant -- ACAPS independence requirement.
 */
export function isExpertRole(role: AuthRole): boolean {
  return (
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertAssociate ||
    role === AuthRole.ExpertCarrierInternal
  );
}

/** Type guard: is this role specific to tow tenants (remorqueurs)? */
export function isTowRole(role: AuthRole): boolean {
  return (
    role === AuthRole.TowAdmin ||
    role === AuthRole.TowDispatcher ||
    role === AuthRole.TowDriver
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
 *
 * v3.0 additions (Sprint 7.5a) :
 *   - garage_parts_manager : terminal sibling under garage_admin.
 *   - carrier_admin "is a" carrier_claims_manager / finance / compliance / expert_manager / partner_manager.
 *   - expert_firm_admin "is a" expert_associate ; expert_independent / expert_carrier_internal are terminal.
 *   - tow_admin "is a" tow_dispatcher "is a" tow_driver.
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
        AuthRole.GaragePartsManager,
      ];
    case AuthRole.GarageChef:
      return [AuthRole.GarageChef, AuthRole.GarageTechnicien];
    case AuthRole.CarrierAdmin:
      return [
        AuthRole.CarrierAdmin,
        AuthRole.CarrierClaimsManager,
        AuthRole.CarrierFinance,
        AuthRole.CarrierCompliance,
        AuthRole.CarrierExpertManager,
        AuthRole.CarrierPartnerManager,
      ];
    case AuthRole.ExpertFirmAdmin:
      return [AuthRole.ExpertFirmAdmin, AuthRole.ExpertAssociate];
    case AuthRole.TowAdmin:
      return [AuthRole.TowAdmin, AuthRole.TowDispatcher, AuthRole.TowDriver];
    case AuthRole.TowDispatcher:
      return [AuthRole.TowDispatcher, AuthRole.TowDriver];
    case AuthRole.GarageTechnicien:
    case AuthRole.GarageComptable:
    case AuthRole.GarageCommercial:
    case AuthRole.GaragePartsManager:
    case AuthRole.CarrierClaimsManager:
    case AuthRole.CarrierFinance:
    case AuthRole.CarrierCompliance:
    case AuthRole.CarrierExpertManager:
    case AuthRole.CarrierPartnerManager:
    case AuthRole.ExpertIndependent:
    case AuthRole.ExpertAssociate:
    case AuthRole.ExpertCarrierInternal:
    case AuthRole.TowDriver:
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
 * Tenant admins MUST have MFA enabled when they create their tenant (Sprint 6).
 */
export function isMfaMandatory(role: AuthRole): boolean {
  return (
    role === AuthRole.SuperAdminPlatform ||
    role === AuthRole.AnalystSupport ||
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.GarageAdmin ||
    role === AuthRole.CarrierAdmin ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.TowAdmin
  );
}

/**
 * Whether WebAuthn / Passkey biometric login is preferred for this role (Sprint 23).
 * garage_technicien and tow_driver work on PWA mobile in field environment without keyboard.
 */
export function prefersWebAuthn(role: AuthRole): boolean {
  return role === AuthRole.GarageTechnicien || role === AuthRole.TowDriver;
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
  AuthRole.Assure,
  AuthRole.Prospect,
]);
