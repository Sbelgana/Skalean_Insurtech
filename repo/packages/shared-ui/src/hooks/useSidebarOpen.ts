'use client';

/**
 * useSidebarOpen -- Zustand persist store for sidebar collapse/expand state.
 *
 * - isOpen       : desktop collapse state (persisted to localStorage)
 * - isDrawerOpen : mobile drawer state (ephemeral, not persisted)
 * - hasHydrated  : true after localStorage rehydration (prevents SSR mismatch)
 *
 * Reference : task-1.4.14 Sprint 4 Phase 1
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';

interface SidebarState {
  isOpen: boolean;
  isDrawerOpen: boolean;
  hasHydrated: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setHydrated: (h: boolean) => void;
}

type PersistedState = Pick<SidebarState, 'isOpen'>;

/**
 * Safe localStorage storage adapter.
 * Uses bare `localStorage` identifier (resolves through globalThis) so that
 * vi.stubGlobal('localStorage', mock) in tests can intercept calls without
 * having to replace the entire window object.
 * Handles SSR (no localStorage) and security restrictions gracefully.
 */
function makeSafeStorage(): PersistStorage<PersistedState> {
  return {
    getItem: (name: string): StorageValue<PersistedState> | null => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof localStorage === 'undefined') return null;
      try {
        const str = localStorage.getItem(name);
        if (str === null) return null;
        return JSON.parse(str) as StorageValue<PersistedState>;
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<PersistedState>): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Silently ignore (e.g., private browsing storage quota exceeded)
      }
    },
    removeItem: (name: string): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(name);
      } catch {
        // Silently ignore
      }
    },
  };
}

export const useSidebarOpen = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isDrawerOpen: false,
      hasHydrated: false,
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setDrawerOpen: (open) => set({ isDrawerOpen: open }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
      setHydrated: (h) => set({ hasHydrated: h }),
    }),
    {
      name: 'skalean-sidebar-open',
      storage: makeSafeStorage(),
      // Only persist the collapse state; drawer and hydration flag are ephemeral
      partialize: (state) => ({ isOpen: state.isOpen }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// Trigger rehydration on the client after module load (SSR guard)
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (typeof localStorage !== 'undefined') {
  void useSidebarOpen.persist.rehydrate();
}
