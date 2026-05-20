/**
 * Tests ReadinessCacheService -- LRU cache 5s pour /readyz.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HealthCheckResult } from '@nestjs/terminus';
import { ReadinessCacheService } from './readiness-cache.service';

const mockResult: HealthCheckResult = {
  status: 'ok',
  info: {},
  error: {},
  details: {},
};

describe('ReadinessCacheService', () => {
  let cache: ReadinessCacheService;

  beforeEach(() => {
    cache = new ReadinessCacheService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('get retourne null si vide', () => {
    expect(cache.get()).toBeNull();
  });

  it('set + get retourne le result', () => {
    cache.set(mockResult);
    expect(cache.get()).toEqual(mockResult);
  });

  it('cache expire apres TTL 5s', () => {
    vi.useFakeTimers();
    cache.set(mockResult);
    expect(cache.get()).not.toBeNull();
    vi.advanceTimersByTime(6000);
    expect(cache.get()).toBeNull();
  });

  it('cache valide avant TTL (4s)', () => {
    vi.useFakeTimers();
    cache.set(mockResult);
    vi.advanceTimersByTime(4000);
    expect(cache.get()).not.toBeNull();
  });

  it('invalidate vide le cache', () => {
    cache.set(mockResult);
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });

  it('markShuttingDown -> get retourne null meme si cache plein', () => {
    cache.set(mockResult);
    cache.markShuttingDown();
    expect(cache.get()).toBeNull();
  });

  it('reset restaure letat initial', () => {
    cache.markShuttingDown();
    cache.reset();
    cache.set(mockResult);
    expect(cache.get()).not.toBeNull();
  });

  it('getAge retourne null si cache vide', () => {
    expect(cache.getAge()).toBeNull();
  });

  it('getAge retourne lage du cache en ms', () => {
    vi.useFakeTimers();
    cache.set(mockResult);
    vi.advanceTimersByTime(2000);
    const age = cache.getAge();
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThanOrEqual(2000);
  });

  it('onModuleDestroy marque shutdown', () => {
    cache.set(mockResult);
    cache.onModuleDestroy();
    expect(cache.get()).toBeNull();
  });
});
