/**
 * RoleHierarchy DAG -- Sprint 7 Tache 2.3.2, etendu Sprint 7.5a (v3.0 foundation).
 *
 * Convention :
 *   - Map[parent] = enfants directs (1 niveau)
 *   - Resolution recursive via HierarchyResolver.getEffectivePermissions()
 *   - Pas de cycle (DFS valide au boot)
 *   - Pas de cross-domain broker <-> garage <-> carrier <-> expert <-> tow
 *
 * v3.0 (Sprint 7.5a) :
 *   - Garage : ajout sibling garage_parts_manager (PartsHub, decision-014).
 *   - Carrier : chaine simple carrier_admin -> 5 enfants (claims_manager, finance, compliance, expert_manager, partner_manager).
 *   - Expert : expert_firm_admin -> expert_associate ; expert_independent et expert_carrier_internal terminaux.
 *   - Tow : tow_admin -> tow_dispatcher -> tow_driver.
 */

import { AuthRole } from '../types/auth-roles.js';

export const RoleHierarchy: Record<AuthRole, readonly AuthRole[]> = {
  // Platform : pas hierarchie traditionnelle.
  [AuthRole.SuperAdminPlatform]: [],
  [AuthRole.AnalystSupport]: [],

  // Broker : chaine simple 3 niveaux.
  [AuthRole.BrokerAdmin]: [AuthRole.BrokerUser],
  [AuthRole.BrokerUser]: [AuthRole.BrokerAssistant],
  [AuthRole.BrokerAssistant]: [],

  // Garage : DAG multi-enfants (PartsManager sibling v3.0).
  [AuthRole.GarageAdmin]: [
    AuthRole.GarageChef,
    AuthRole.GarageComptable,
    AuthRole.GarageCommercial,
    AuthRole.GaragePartsManager,
  ],
  [AuthRole.GarageChef]: [AuthRole.GarageTechnicien],
  [AuthRole.GarageTechnicien]: [],
  [AuthRole.GarageComptable]: [],
  [AuthRole.GarageCommercial]: [],
  [AuthRole.GaragePartsManager]: [],

  // Carrier (v3.0) : carrier_admin -> 5 enfants specialises.
  [AuthRole.CarrierAdmin]: [
    AuthRole.CarrierClaimsManager,
    AuthRole.CarrierFinance,
    AuthRole.CarrierCompliance,
    AuthRole.CarrierExpertManager,
    AuthRole.CarrierPartnerManager,
  ],
  [AuthRole.CarrierClaimsManager]: [],
  [AuthRole.CarrierFinance]: [],
  [AuthRole.CarrierCompliance]: [],
  [AuthRole.CarrierExpertManager]: [],
  [AuthRole.CarrierPartnerManager]: [],

  // Expert (v3.0) : firm_admin -> associate ; independant et carrier_internal terminaux.
  [AuthRole.ExpertIndependent]: [],
  [AuthRole.ExpertFirmAdmin]: [AuthRole.ExpertAssociate],
  [AuthRole.ExpertAssociate]: [],
  [AuthRole.ExpertCarrierInternal]: [],

  // Tow (v3.0) : tow_admin -> tow_dispatcher -> tow_driver.
  [AuthRole.TowAdmin]: [AuthRole.TowDispatcher],
  [AuthRole.TowDispatcher]: [AuthRole.TowDriver],
  [AuthRole.TowDriver]: [],

  // L3 + public terminaux.
  [AuthRole.Assure]: [],
  [AuthRole.Prospect]: [],
};

export function getDirectChildren(role: AuthRole): readonly AuthRole[] {
  return RoleHierarchy[role];
}

export function isTerminalRole(role: AuthRole): boolean {
  return RoleHierarchy[role].length === 0;
}

export function isBrokerRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant
  );
}

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

export function isExpertRole(role: AuthRole): boolean {
  return (
    role === AuthRole.ExpertIndependent ||
    role === AuthRole.ExpertFirmAdmin ||
    role === AuthRole.ExpertAssociate ||
    role === AuthRole.ExpertCarrierInternal
  );
}

export function isTowRole(role: AuthRole): boolean {
  return (
    role === AuthRole.TowAdmin ||
    role === AuthRole.TowDispatcher ||
    role === AuthRole.TowDriver
  );
}

export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

export const ALL_ROLES_IN_HIERARCHY = Object.keys(RoleHierarchy) as readonly AuthRole[];
