/**
 * Zustand assure tenant store -- web-assure-mobile
 * Reference : task-1.4.7 Sprint 4 Phase 1
 *
 * Stocke le tenant_id courant en sessionStorage (isole par tab).
 * Cle de stockage : skalean.assure.mobile
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
      name: 'skalean.assure.mobile',
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
