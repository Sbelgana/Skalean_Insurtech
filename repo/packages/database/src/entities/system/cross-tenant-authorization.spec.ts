/**
 * Tests CrossTenantAuthorization types (Sprint 7.5a Foundation Migration v3.0).
 *
 * Validates :
 *   - 7 cross-tenant authorization types (3 v2.2 + 4 v3.0).
 *   - 8 cross-tenant resource types (5 v2.2 + 3 v3.0).
 *   - Frozen arrays + uniqueness.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_CROSS_TENANT_AUTHORIZATION_TYPES,
  ALL_CROSS_TENANT_RESOURCE_TYPES,
  type CrossTenantAuthorizationType,
  type CrossTenantResourceType,
} from './cross-tenant-authorization.entity.js';

describe('CrossTenantAuthorizationType (v3.0 -- Sprint 7.5a)', () => {
  it('contains exactly 7 types (3 v2.2 + 4 v3.0)', () => {
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toHaveLength(7);
  });

  it('preserves the 3 v2.2 types', () => {
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('broker_to_garage_assignment');
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('assure_to_garage_visit');
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('multi_tenant_user_access');
  });

  it('adds the 4 v3.0 types (decision-012)', () => {
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('client_to_tower_dispatch');
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('tower_to_garage_delivery');
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('garage_to_expert_request');
    expect(ALL_CROSS_TENANT_AUTHORIZATION_TYPES).toContain('garage_to_carrier_quote');
  });

  it('contains no duplicate types', () => {
    const set = new Set(ALL_CROSS_TENANT_AUTHORIZATION_TYPES);
    expect(set.size).toBe(ALL_CROSS_TENANT_AUTHORIZATION_TYPES.length);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(ALL_CROSS_TENANT_AUTHORIZATION_TYPES)).toBe(true);
  });

  it('all values match the TypeScript union type', () => {
    for (const value of ALL_CROSS_TENANT_AUTHORIZATION_TYPES) {
      const v: CrossTenantAuthorizationType = value;
      expect(typeof v).toBe('string');
    }
  });
});

describe('CrossTenantResourceType (v3.0 -- Sprint 7.5a)', () => {
  it('contains exactly 8 resource types (5 v2.2 + 3 v3.0)', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toHaveLength(8);
  });

  it('preserves the 5 v2.2 resources', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('sinistre');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('police');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('devis');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('facture');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('tenant');
  });

  it('adds the 3 v3.0 resources (mission, expertise, parts_order)', () => {
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('mission');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('expertise');
    expect(ALL_CROSS_TENANT_RESOURCE_TYPES).toContain('parts_order');
  });

  it('contains no duplicate resource types', () => {
    const set = new Set(ALL_CROSS_TENANT_RESOURCE_TYPES);
    expect(set.size).toBe(ALL_CROSS_TENANT_RESOURCE_TYPES.length);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(ALL_CROSS_TENANT_RESOURCE_TYPES)).toBe(true);
  });

  it('all values match the TypeScript union type', () => {
    for (const value of ALL_CROSS_TENANT_RESOURCE_TYPES) {
      const v: CrossTenantResourceType = value;
      expect(typeof v).toBe('string');
    }
  });
});
