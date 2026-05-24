/**
 * Types pour CrossTenantAuthorizationService.
 *
 * v2.2 (3 types -- Sprint 26 orchestration prep) :
 *   broker_to_garage_assignment : Sprint 22 sinistre dispatch broker -> garage
 *   assure_to_garage_visit      : Sprint 19/35 assure choix garage M8
 *   multi_tenant_user_access    : Sprint 27 super_admin/analyst transverse
 *
 * v3.0 (+4 types Sprint 7.5a -- decision-012/013) :
 *   client_to_tower_dispatch    : assure/courtier declenche mission remorquage
 *   tower_to_garage_delivery    : remorqueur livre vehicule au garage cible
 *   garage_to_expert_request    : garage notifie expert designe pour validation devis
 *   garage_to_carrier_quote     : garage envoie devis a la compagnie en copie
 *
 * Architecture interconnect Sprint 1+2 :
 *   helper Postgres app_can_access_tenant() Cond 3 lit
 *   current_setting(app.cross_tenant_authorization_id) et verifie row active.
 *   Pas de duplication clause RLS -- single source of truth.
 *
 * Reference : Sprint 6 / Tache 2.2.6 + Sprint 7.5a / Tache 7.5a.3.
 */

export enum CrossTenantAuthorizationType {
  BrokerToGarageAssignment = 'broker_to_garage_assignment',
  AssureToGarageVisit = 'assure_to_garage_visit',
  MultiTenantUserAccess = 'multi_tenant_user_access',
  // v3.0 -- Sprint 7.5a
  ClientToTowerDispatch = 'client_to_tower_dispatch',
  TowerToGarageDelivery = 'tower_to_garage_delivery',
  GarageToExpertRequest = 'garage_to_expert_request',
  GarageToCarrierQuote = 'garage_to_carrier_quote',
}

export type CrossTenantResourceType =
  // v2.2
  | 'sinistre'
  | 'police'
  | 'devis'
  | 'facture'
  | 'tenant'
  // v3.0 -- Sprint 7.5a
  | 'mission'
  | 'expertise'
  | 'parts_order';

export type CrossTenantValidateReason =
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SCOPE_MISMATCH'
  | 'TENANT_MISMATCH'
  | 'RESOURCE_MISMATCH';

export interface ValidateAuthorizationResult {
  allowed: boolean;
  reason?: CrossTenantValidateReason;
  scope?: readonly string[];
  type?: CrossTenantAuthorizationType;
}

export interface CrossTenantAuthorizationDto {
  id: string;
  type: CrossTenantAuthorizationType;
  fromTenantId: string;
  toTenantId: string;
  scope: readonly string[];
  resourceType?: CrossTenantResourceType;
  resourceId?: string;
  grantedByUserId: string;
  grantedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedByUserId?: string;
  revokedReason?: string;
  metadata?: Record<string, unknown>;
}

export const CROSS_TENANT_ERROR_CODES = {
  AUTHORIZATION_NOT_FOUND: 'CROSS_TENANT_AUTHORIZATION_NOT_FOUND',
  AUTHORIZATION_REVOKED: 'CROSS_TENANT_AUTHORIZATION_REVOKED',
  AUTHORIZATION_EXPIRED: 'CROSS_TENANT_AUTHORIZATION_EXPIRED',
  AUTHORIZATION_ALREADY_REVOKED: 'CROSS_TENANT_AUTHORIZATION_ALREADY_REVOKED',
  SCOPE_MISMATCH: 'CROSS_TENANT_SCOPE_MISMATCH',
  TENANT_MISMATCH: 'CROSS_TENANT_TENANT_MISMATCH',
  INVALID_TYPE: 'CROSS_TENANT_INVALID_TYPE',
  INVALID_EXPIRES_AT: 'CROSS_TENANT_INVALID_EXPIRES_AT',
  SAME_FROM_TO_TENANT: 'CROSS_TENANT_SAME_FROM_TO',
} as const;

/** Default expiration windows par type (en jours). */
export const DEFAULT_EXPIRATION_DAYS: Record<CrossTenantAuthorizationType, number> = {
  [CrossTenantAuthorizationType.BrokerToGarageAssignment]: 30,
  [CrossTenantAuthorizationType.AssureToGarageVisit]: 7,
  [CrossTenantAuthorizationType.MultiTenantUserAccess]: 90,
  // v3.0 -- Sprint 7.5a
  [CrossTenantAuthorizationType.ClientToTowerDispatch]: 1,
  [CrossTenantAuthorizationType.TowerToGarageDelivery]: 3,
  [CrossTenantAuthorizationType.GarageToExpertRequest]: 14,
  [CrossTenantAuthorizationType.GarageToCarrierQuote]: 30,
};

/** Max expiration windows par type (en jours). */
export const MAX_EXPIRATION_DAYS: Record<CrossTenantAuthorizationType, number> = {
  [CrossTenantAuthorizationType.BrokerToGarageAssignment]: 90,
  [CrossTenantAuthorizationType.AssureToGarageVisit]: 30,
  [CrossTenantAuthorizationType.MultiTenantUserAccess]: 365,
  // v3.0 -- Sprint 7.5a
  [CrossTenantAuthorizationType.ClientToTowerDispatch]: 7,
  [CrossTenantAuthorizationType.TowerToGarageDelivery]: 14,
  [CrossTenantAuthorizationType.GarageToExpertRequest]: 60,
  [CrossTenantAuthorizationType.GarageToCarrierQuote]: 90,
};
