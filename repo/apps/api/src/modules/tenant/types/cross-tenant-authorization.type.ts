/**
 * Types pour CrossTenantAuthorizationService.
 *
 * 3 types v2.0 (Sprint 26 orchestration prep) :
 *   broker_to_garage_assignment : Sprint 22 sinistre dispatch broker -> garage
 *   assure_to_garage_visit      : Sprint 19/35 assure choix garage M8
 *   multi_tenant_user_access    : Sprint 27 super_admin/analyst transverse
 *
 * Architecture interconnect Sprint 1+2 :
 *   helper Postgres app_can_access_tenant() Cond 3 lit
 *   current_setting(app.cross_tenant_authorization_id) et verifie row active.
 *   Pas de duplication clause RLS -- single source of truth.
 *
 * Reference : Sprint 6 / Tache 2.2.6.
 */

export enum CrossTenantAuthorizationType {
  BrokerToGarageAssignment = 'broker_to_garage_assignment',
  AssureToGarageVisit = 'assure_to_garage_visit',
  MultiTenantUserAccess = 'multi_tenant_user_access',
}

export type CrossTenantResourceType =
  | 'sinistre'
  | 'police'
  | 'devis'
  | 'facture'
  | 'tenant';

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
};

/** Max expiration windows par type (en jours). */
export const MAX_EXPIRATION_DAYS: Record<CrossTenantAuthorizationType, number> = {
  [CrossTenantAuthorizationType.BrokerToGarageAssignment]: 90,
  [CrossTenantAuthorizationType.AssureToGarageVisit]: 30,
  [CrossTenantAuthorizationType.MultiTenantUserAccess]: 365,
};
