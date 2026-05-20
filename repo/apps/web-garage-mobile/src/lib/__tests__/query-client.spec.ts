/**
 * query-client.spec.ts -- web-garage-mobile
 * Reference : task-1.4.3 Sprint 4 Phase 1
 */
import { describe, it, expect, vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), init: vi.fn(), setTag: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('pino', () => {
  const mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pino: any = vi.fn(() => mockLogger);
  pino.stdTimeFunctions = { isoTime: vi.fn() };
  return { default: pino };
});

describe('query-client', () => {
  it('creates a QueryClient with staleTime 30s', () => {
    const qc = createQueryClient();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it('creates a QueryClient with gcTime 5min', () => {
    const qc = createQueryClient();
    expect(qc.getDefaultOptions().queries?.gcTime).toBe(300_000);
  });

  it('does NOT retry on 404', () => {
    const qc = createQueryClient();
    const retry = qc.getDefaultOptions().queries?.retry as (count: number, err: unknown) => boolean;
    expect(retry(0, { response: { status: 404 } })).toBe(false);
  });

  it('retries up to 3 times on 503', () => {
    const qc = createQueryClient();
    const retry = qc.getDefaultOptions().queries?.retry as (count: number, err: unknown) => boolean;
    expect(retry(0, { response: { status: 503 } })).toBe(true);
    expect(retry(2, { response: { status: 503 } })).toBe(true);
    expect(retry(3, { response: { status: 503 } })).toBe(false);
  });

  it('uses exponential backoff capped at 30s', () => {
    const qc = createQueryClient();
    const delay = qc.getDefaultOptions().queries?.retryDelay as (idx: number) => number;
    expect(delay(0)).toBe(1000);
    expect(delay(3)).toBe(8000);
    expect(delay(10)).toBe(30_000);
  });
});
