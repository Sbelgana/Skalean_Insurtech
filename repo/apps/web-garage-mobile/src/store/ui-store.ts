/**
 * Zustand UI store -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Stocke l'etat UI transversal (bottom nav active, theme override).
 * Mobile-first : pas de sidebar, navigation bas de page.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  activeBottomTab: string;
  themeOverride: 'light' | 'dark' | 'system' | null;
  setActiveBottomTab: (tab: string) => void;
  setThemeOverride: (theme: 'light' | 'dark' | 'system' | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeBottomTab: 'tasks',
      themeOverride: null,
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
      setThemeOverride: (theme) => set({ themeOverride: theme }),
    }),
    {
      name: 'skalean.mobile.ui',
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
