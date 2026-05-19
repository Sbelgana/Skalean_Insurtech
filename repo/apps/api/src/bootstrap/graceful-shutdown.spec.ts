/**
 * Tests unitaires pour graceful-shutdown.ts
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerGracefulShutdown,
  resetShutdownStateForTesting,
} from './graceful-shutdown';
import type { INestApplication, LoggerService } from '@nestjs/common';

// Mock telemetry pour eviter appels reels OTEL.
vi.mock('@insurtech/shared-utils/telemetry', () => ({
  startTelemetry: vi.fn(),
  shutdownTelemetry: vi.fn().mockResolvedValue(undefined),
}));

function makeApp(closeFn?: () => Promise<void>): INestApplication {
  return {
    close: vi.fn(closeFn ?? (() => Promise.resolve())),
  } as unknown as INestApplication;
}

function makeLogger(): LoggerService {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  } as unknown as LoggerService;
}

describe('registerGracefulShutdown', () => {
  beforeEach(() => {
    resetShutdownStateForTesting();
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('registers handlers for SIGTERM and SIGINT', () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM', 'SIGINT'], logger });
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
  });

  it('calls app.close() on SIGTERM', async () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 150));
    expect(app.close).toHaveBeenCalled();
  });

  it('exits with code 0 on successful shutdown', async () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('ignores duplicate SIGTERM signals (anti-double-shutdown)', async () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    process.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 250));
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Already shutting down'),
    );
  });

  it('exits with code 1 if shutdown timeout exceeded', async () => {
    // app.close never resolves to simulate timeout.
    const app = makeApp(() => new Promise(() => {}));
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 100, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise((r) => setTimeout(r, 400));
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown timeout exceeded'),
    );
  });

  it('handles uncaughtException by initiating shutdown', async () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('uncaughtException', new Error('test crash'));
    await new Promise((r) => setTimeout(r, 200));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Uncaught exception'),
      expect.any(String),
    );
    expect(app.close).toHaveBeenCalled();
  });

  it('handles unhandledRejection by initiating shutdown', async () => {
    const app = makeApp();
    const logger = makeLogger();
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('unhandledRejection', new Error('test rejection'), Promise.resolve());
    await new Promise((r) => setTimeout(r, 200));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled rejection'),
    );
  });
});
