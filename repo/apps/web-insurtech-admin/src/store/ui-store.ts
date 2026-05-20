/**
 * Zustand UI store -- web-insurtech-admin
 * Reference : task-1.4.4 Sprint 4 Phase 1
 *
 * Stocke l'etat UI transversal (sidebar collapse, theme override).
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  themeOverride: 'light' | 'dark' | 'system' | null;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setThemeOverride: (theme: 'light' | 'dark' | 'system' | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      themeOverride: null,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setThemeOverride: (theme) => set({ themeOverride: theme }),
    }),
    {
      name: 'skalean.admin.ui',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return localStorage;
      }),
    },
  ),
);
