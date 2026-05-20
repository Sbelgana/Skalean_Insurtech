// Vitest setup -- happy-dom + globals
import { vi, beforeEach, afterEach } from 'vitest';

// Polyfill crypto.randomUUID for happy-dom
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () =>
      '00000000-0000-7000-8000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
  } as Crypto;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

afterEach(() => {
  // Use clearAllMocks (not restoreAllMocks) to preserve mockResolvedValue/mockReturnValue
  // implementations set in vi.mock() factory functions across tests within the same suite.
  vi.clearAllMocks();
});
