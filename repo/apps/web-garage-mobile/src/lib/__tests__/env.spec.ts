/**
 * env.spec.ts -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Utilise vi.stubEnv() pour eviter les erreurs TypeScript avec les proprietes
 * readonly du type ProcessEnv augmente dans src/types/env.d.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Helper pour ecrire sur process.env sans conflit readonly
const setEnv = (k: string, v: string) => vi.stubEnv(k, v);
const delEnv = (k: string) => vi.stubEnv(k, undefined as unknown as string);

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    setEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3003');
    delEnv('NEXT_PUBLIC_DEFAULT_LOCALE');
    delEnv('NEXT_PUBLIC_SENTRY_DSN');
    delEnv('NEXT_PUBLIC_TENANT_ID_HEADER');
  });

  it('parses default values when env empty', async () => {
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_API_URL).toBe('http://localhost:4000');
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('fr');
    expect(env.NEXT_PUBLIC_PWA_ENABLED).toBe('true');
  });

  it('NEXT_PUBLIC_APP_URL defaults to port 3003', async () => {
    delEnv('NEXT_PUBLIC_APP_URL');
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3003');
  });

  it('rejects invalid URL for NEXT_PUBLIC_API_URL', async () => {
    setEnv('NEXT_PUBLIC_API_URL', 'not-a-url');
    await expect(import('@/lib/env')).rejects.toThrow(/Invalid/);
  });

  it('rejects invalid locale enum', async () => {
    setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    setEnv('NEXT_PUBLIC_DEFAULT_LOCALE', 'es');
    await expect(import('@/lib/env')).rejects.toThrow();
  });

  it('accepts empty optional values', async () => {
    setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    setEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('');
  });

  it('exposes header names with default x-tenant-id', async () => {
    setEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
    delEnv('NEXT_PUBLIC_TENANT_ID_HEADER');
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_TENANT_ID_HEADER).toBe('x-tenant-id');
  });

  it('PWA_ENABLED defaults to true for mobile app', async () => {
    delEnv('NEXT_PUBLIC_PWA_ENABLED');
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_PWA_ENABLED).toBe('true');
  });

  it('LIGHTHOUSE_PROFILE defaults to mobile', async () => {
    delEnv('NEXT_PUBLIC_LIGHTHOUSE_PROFILE');
    const { env } = await import('@/lib/env');
    expect(env.NEXT_PUBLIC_LIGHTHOUSE_PROFILE).toBe('mobile');
  });
});
