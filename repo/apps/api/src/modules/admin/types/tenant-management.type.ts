/**
 * Types pour TenantManagementService.
 *
 * Reference : Sprint 6 / Tache 2.2.7.
 */

import type { TenantSettings } from '@insurtech/auth';

export interface TenantListFilters {
  type?: 'broker' | 'garage' | 'mixed';
  /** 'active' = deletedAt IS NULL, 'archived' = deletedAt set. Sprint 2.2.9 ajoutera suspended/pending. */
  status?: 'active' | 'archived';
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TenantManagementDto {
  id: string;
  name: string;
  type: 'broker' | 'garage' | 'mixed';
  status: 'active' | 'archived';
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export const TENANT_MANAGEMENT_ERROR_CODES = {
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_NAME_CONFLICT: 'TENANT_NAME_CONFLICT',
  TENANT_ALREADY_ARCHIVED: 'TENANT_ALREADY_ARCHIVED',
  TENANT_NOT_ARCHIVED: 'TENANT_NOT_ARCHIVED',
  TENANT_FIELD_NOT_UPDATEABLE: 'TENANT_FIELD_NOT_UPDATEABLE',
} as const;
