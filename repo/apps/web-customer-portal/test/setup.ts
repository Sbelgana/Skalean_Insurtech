import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
  if (!('randomUUID' in globalThis.crypto)) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: () => '00000000-0000-4000-8000-000000000000',
    });
  }
  Object.assign(process.env, {
    NEXT_PUBLIC_API_URL: 'http://localhost:4000',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3004',
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
