/**
 * Tests unitaires pour start-time-logger.ts
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi } from 'vitest';
import { measureBootTime, BOOT_TIME_WARNING_THRESHOLD_MS } from './start-time-logger';
import type { LoggerService } from '@nestjs/common';

function makeLogger(): LoggerService {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  } as unknown as LoggerService;
}

describe('measureBootTime', () => {
  it('returns duration in ms as non-negative integer', () => {
    const start = process.hrtime.bigint();
    const logger = makeLogger();
    const duration = measureBootTime(start, logger);
    expect(Number.isInteger(duration)).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('does not warn if duration is below threshold', () => {
    const start = process.hrtime.bigint();
    const logger = makeLogger();
    measureBootTime(start, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns if duration exceeds BOOT_TIME_WARNING_THRESHOLD_MS', () => {
    // Simulate a start time far in the past.
    const pastNs = BigInt((BOOT_TIME_WARNING_THRESHOLD_MS + 1000) * 1_000_000);
    const start = process.hrtime.bigint() - pastNs;
    const logger = makeLogger();
    measureBootTime(start, logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Boot time exceeded threshold'),
    );
  });

  it('BOOT_TIME_WARNING_THRESHOLD_MS is 5000', () => {
    expect(BOOT_TIME_WARNING_THRESHOLD_MS).toBe(5000);
  });
});
