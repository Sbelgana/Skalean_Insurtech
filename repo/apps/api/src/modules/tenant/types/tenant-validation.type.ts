/**
 * Types pour TenantValidationService.
 *
 * Reference : Sprint 6 / Tache 2.2.5.
 */

import type { TenantSettings } from '@insurtech/auth';

export type UserAccessReason =
  | 'USER_NOT_LINKED_TO_TENANT'
  | 'USER_TENANT_ACCESS_REVOKED'
  | 'USER_DISABLED'
  | 'TENANT_NOT_FOUND';

export interface UserAccessResult {
  allowed: boolean;
  role?: string;
  reason?: UserAccessReason;
}

/**
 * DTO tenant (vs entity TypeORM) -- serialise-friendly pour cache JSON.
 * Sprint 6 : `status` calcule a partir de `deletedAt IS NULL` (champ status sera
 * ajoute par Tache 2.2.9 TenantSuspensionService).
 */
export interface TenantDto {
  id: string;
  name: string;
  type: 'broker' | 'garage' | 'mixed';
  status: 'active' | 'archived';
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface MultiTenantUserResult {
  tenants: Array<{ id: string; name: string; type: 'broker' | 'garage' | 'mixed'; role: string }>;
  total: number;
  page: number;
  pageSize: number;
}

export const TENANT_VALIDATION_ERROR_CODES = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  TENANT_ARCHIVED: 'TENANT_ARCHIVED',
  TENANT_PENDING_SETUP: 'TENANT_PENDING_SETUP',
  USER_NOT_LINKED_TO_TENANT: 'USER_NOT_LINKED_TO_TENANT',
  USER_TENANT_ACCESS_REVOKED: 'USER_TENANT_ACCESS_REVOKED',
  USER_DISABLED: 'USER_DISABLED',
} as const;
