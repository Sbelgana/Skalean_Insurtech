// Stub for @insurtech/shared-ui/stores/tenant-store
// Used by vitest.config.ts alias -- real implementation lives in Sprint 4 shared-ui package.
export const useTenantStore = {
  getState: () => ({
    tenantId: null as string | null,
    traceId: null as string | null,
    userId: null as string | null,
  }),
};
