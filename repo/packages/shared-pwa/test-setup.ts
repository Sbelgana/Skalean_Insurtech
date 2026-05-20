/**
 * Vitest global test setup -- shared-pwa
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom does not have a native matchMedia implementation
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom localStorage mock: provide a minimal working implementation
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageData[key];
  },
  clear: () => {
    for (const key of Object.keys(localStorageData)) {
      delete localStorageData[key];
    }
  },
  get length() {
    return Object.keys(localStorageData).length;
  },
  key: (index: number) => Object.keys(localStorageData)[index] ?? null,
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
