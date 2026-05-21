/**
 * RoleHierarchy DAG -- Sprint 7 Tache 2.3.2.
 *
 * Convention :
 *   - Map[parent] = enfants directs (1 niveau)
 *   - Resolution recursive via HierarchyResolver.getEffectivePermissions()
 *   - Pas de cycle (DFS valide au boot)
 *   - Pas de cross-domain broker <-> garage
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

  // Garage : DAG multi-enfants.
  [AuthRole.GarageAdmin]: [
    AuthRole.GarageChef,
    AuthRole.GarageComptable,
    AuthRole.GarageCommercial,
  ],
  [AuthRole.GarageChef]: [AuthRole.GarageTechnicien],
  [AuthRole.GarageTechnicien]: [],
  [AuthRole.GarageComptable]: [],
  [AuthRole.GarageCommercial]: [],

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
    role === AuthRole.GarageCommercial
  );
}

export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

export const ALL_ROLES_IN_HIERARCHY = Object.keys(RoleHierarchy) as readonly AuthRole[];
