/**
 * Zustand assure tenant store -- web-assure-portal
 * Reference : task-1.4.6 Sprint 4 Phase 1
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AssureTenantState {
  tenantId: string | null;
  hasHydrated: boolean;
  setTenantId: (id: string) => void;
  clearTenant: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAssureTenantStore = create<AssureTenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      hasHydrated: false,
      setTenantId: (id) => set({ tenantId: id }),
      clearTenant: () => set({ tenantId: null }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: 'skalean.assure',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return sessionStorage;
      }),
      partialize: (state) => ({ tenantId: state.tenantId }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
