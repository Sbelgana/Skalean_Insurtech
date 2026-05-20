/**
 * Tests sentry.config.ts -- initSentry + sentryCaptureException + beforeSend.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.12 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ----- Mocks hoistes (doivent preceder vi.mock) -----
// vi.hoisted() garantit que les variables sont definies avant le hoisting de vi.mock.
const { mockInit, mockCaptureException, mockWithScope } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCaptureException: vi.fn(),
  mockWithScope: vi.fn((cb: (scope: unknown) => void) => {
    cb({ setTag: vi.fn(), setUser: vi.fn() });
  }),
}));

vi.mock('@sentry/nestjs', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  withScope: mockWithScope,
}));

vi.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: vi.fn(() => ({})),
}));

import {
  initSentry,
  sentryCaptureException,
  isSentryInitialized,
  resetSentryStateForTesting,
} from './sentry.config';

describe('sentry.config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSentryStateForTesting();
    delete process.env['SENTRY_DSN'];
    // Reassign mockWithScope after clearAllMocks
    mockWithScope.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag: vi.fn(), setUser: vi.fn() });
    });
  });

  afterEach(() => {
    delete process.env['SENTRY_DSN'];
    resetSentryStateForTesting();
  });

  // ---------------------------------------------------------------
  // initSentry()
  // ---------------------------------------------------------------

  it('initSentry() skip si SENTRY_DSN absent (no-op)', () => {
    initSentry();
    expect(mockInit).not.toHaveBeenCalled();
    expect(isSentryInitialized()).toBe(false);
  });

  it('initSentry() appelle Sentry.init() si SENTRY_DSN defini', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    initSentry();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(isSentryInitialized()).toBe(true);
  });

  it('initSentry() passe dsn + environment + release a Sentry.init()', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    process.env['NODE_ENV'] = 'production';
    process.env['APP_VERSION'] = '2.2.0';
    initSentry();
    const initArg = mockInit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(initArg?.dsn).toBe('https://abc@sentry.io/123');
    expect(initArg?.environment).toBe('production');
    expect(String(initArg?.release)).toContain('2.2.0');
    delete process.env['NODE_ENV'];
    delete process.env['APP_VERSION'];
  });

  it('initSentry() tracesSampleRate 0.1 en production', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    process.env['NODE_ENV'] = 'production';
    initSentry();
    const initArg = mockInit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(initArg?.tracesSampleRate).toBe(0.1);
    delete process.env['NODE_ENV'];
  });

  it('initSentry() tracesSampleRate 1.0 en development', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    process.env['NODE_ENV'] = 'development';
    initSentry();
    const initArg = mockInit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(initArg?.tracesSampleRate).toBe(1.0);
    delete process.env['NODE_ENV'];
  });

  // ---------------------------------------------------------------
  // sentryCaptureException()
  // ---------------------------------------------------------------

  it('sentryCaptureException() no-op si Sentry non initialise', () => {
    sentryCaptureException(new Error('test'));
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockWithScope).not.toHaveBeenCalled();
  });

  it('sentryCaptureException() appelle captureException si Sentry initialise', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    initSentry();
    const err = new Error('boom');
    sentryCaptureException(err);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });

  it('sentryCaptureException() injecte tenant_id dans le scope', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    initSentry();
    const mockScope = { setTag: vi.fn(), setUser: vi.fn() };
    mockWithScope.mockImplementationOnce((cb: (s: typeof mockScope) => void) => cb(mockScope));
    sentryCaptureException(new Error('x'), { tenantId: 'tenant-abc' });
    expect(mockScope.setTag).toHaveBeenCalledWith('tenant_id', 'tenant-abc');
  });

  it('sentryCaptureException() injecte user_id dans le scope', () => {
    process.env['SENTRY_DSN'] = 'https://abc@sentry.io/123';
    initSentry();
    const mockScope = { setTag: vi.fn(), setUser: vi.fn() };
    mockWithScope.mockImplementationOnce((cb: (s: typeof mockScope) => void) => cb(mockScope));
    sentryCaptureException(new Error('y'), { userId: 'user-xyz' });
    expect(mockScope.setUser).toHaveBeenCalledWith({ id: 'user-xyz' });
  });
});
