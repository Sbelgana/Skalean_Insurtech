/**
 * Tenant store test fixtures -- web-broker
 * Reference : task-1.4.1 Sprint 4 Phase 1
 */
export const MOCK_TENANT_ID = 'tenant-test-00000000-0000-4000-8000-000000000001';
export const MOCK_TENANT_ID_2 = 'tenant-test-00000000-0000-4000-8000-000000000002';

export const mockTenantState = {
  tenantId: MOCK_TENANT_ID,
  hasHydrated: true,
};

export const emptyTenantState = {
  tenantId: null,
  hasHydrated: false,
};
