/**
 * Types pour TenantSuspensionService.
 *
 * State machine :
 *   pending_setup -> active   (TenantOnboardingService.complete)
 *   active        -> suspended (suspend)
 *   active        -> archived  (TenantManagementService.archive)
 *   suspended     -> active    (reactivate)
 *   suspended     -> archived  (archive)
 *   archived      -> active    (restore)
 *   archived      -> suspended (INTERDIT : doit restore first)
 *
 * Reference : Sprint 6 / Tache 2.2.9.
 */

import type { TenantStatus, TenantSuspensionType } from '@insurtech/database';

export interface SuspendTenantInput {
  reason: string;
  suspensionType: TenantSuspensionType;
}

export interface SuspendedTenantDto {
  id: string;
  name: string;
  type: 'broker' | 'garage' | 'mixed';
  status: TenantStatus;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  suspensionType: TenantSuspensionType | null;
  reactivatedAt: Date | null;
  reactivationReason: string | null;
}

export const SUSPENSION_ERROR_CODES = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_ALREADY_SUSPENDED: 'TENANT_ALREADY_SUSPENDED',
  TENANT_NOT_SUSPENDED: 'TENANT_NOT_SUSPENDED',
  TENANT_ARCHIVED: 'TENANT_ARCHIVED',
  INVALID_STATE_TRANSITION: 'TENANT_INVALID_STATE_TRANSITION',
  INVALID_SUSPENSION_TYPE: 'TENANT_INVALID_SUSPENSION_TYPE',
} as const;

/** Allowed transitions (defensive double-check vs DB constraints). */
export const ALLOWED_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  pending_setup: ['active'],
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: ['active'],
};

export function isTransitionAllowed(from: TenantStatus, to: TenantStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
