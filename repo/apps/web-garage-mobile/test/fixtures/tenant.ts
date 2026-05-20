/**
 * Garage tenant store test fixtures -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 */
export const MOCK_GARAGE_ID = 'garage-test-00000000-0000-4000-8000-000000000001';
export const MOCK_GARAGE_ID_2 = 'garage-test-00000000-0000-4000-8000-000000000002';

export const mockGarageState = {
  tenantId: MOCK_GARAGE_ID,
  hasHydrated: true,
};

export const emptyGarageState = {
  tenantId: null,
  hasHydrated: false,
};
