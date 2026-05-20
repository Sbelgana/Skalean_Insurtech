/**
 * Tests HealthController -- /healthz liveness + /readyz readiness.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @insurtech/database pour eviter loadEnv() au boot du module.
vi.mock('@insurtech/database', () => ({
  AppDataSource: {
    isInitialized: false,
    initialize: vi.fn(async () => {}),
    query: vi.fn(),
  },
}));

import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { KafkaHealthIndicator } from './indicators/kafka-health.indicator';
import { ReadinessCacheService } from './cache/readiness-cache.service';
import type { HealthCheckResult } from '@nestjs/terminus';

const MOCK_HEALTH_RESULT: HealthCheckResult = {
  status: 'ok',
  info: {
    db: { status: 'up' },
    redis: { status: 'up' },
    kafka: { status: 'up' },
  },
  error: {},
  details: {
    db: { status: 'up' },
    redis: { status: 'up' },
    kafka: { status: 'up' },
  },
};

describe('HealthController', () => {
  let controller: HealthController;
  let cache: ReadinessCacheService;
  let mockHealthCheckService: { check: ReturnType<typeof vi.fn> };
  let mockDataSource: { query: ReturnType<typeof vi.fn> };
  let mockRedis: { status: string; ping: ReturnType<typeof vi.fn> };
  let mockProducer: { events: Record<string, string>; on: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockHealthCheckService = {
      check: vi.fn().mockResolvedValue(MOCK_HEALTH_RESULT),
    };
    mockDataSource = { query: vi.fn().mockResolvedValue([{ healthy: 1 }]) };
    mockRedis = { status: 'ready', ping: vi.fn().mockResolvedValue('PONG') };
    mockProducer = {
      events: {
        CONNECT: 'producer.connect',
        DISCONNECT: 'producer.disconnect',
        REQUEST_TIMEOUT: 'producer.request_timeout',
      },
      on: vi.fn(),
    };

    // Instanciation directe sans @nestjs/testing pour eviter les conflits DI.
    const dbIndicator = new DatabaseHealthIndicator(mockDataSource as never);
    const redisIndicator = new RedisHealthIndicator(mockRedis as never);
    const kafkaIndicator = new KafkaHealthIndicator(mockProducer as never);
    cache = new ReadinessCacheService();

    controller = new HealthController(
      mockHealthCheckService as never,
      dbIndicator,
      redisIndicator,
      kafkaIndicator,
      cache,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET /healthz retourne { status: "ok" }', () => {
    const result = controller.liveness();
    expect(result).toEqual({ status: 'ok' });
  });

  it('GET /readyz retourne result avec status ok si all up', async () => {
    cache.reset();
    const result = await controller.readiness();
    expect(result.status).toBe('ok');
  });

  it('GET /readyz utilise cache au second appel (healthCheckService appele une seule fois)', async () => {
    cache.reset();
    await controller.readiness();
    await controller.readiness();
    expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
  });

  it('cache invalide apres TTL 5s (force re-check)', () => {
    vi.useFakeTimers();
    cache.reset();
    cache.set(MOCK_HEALTH_RESULT);
    expect(cache.get()).not.toBeNull();
    vi.advanceTimersByTime(6000);
    expect(cache.get()).toBeNull();
  });

  it('cache cleared on shutdown (markShuttingDown)', () => {
    cache.reset();
    cache.set(MOCK_HEALTH_RESULT);
    expect(cache.get()).not.toBeNull();
    cache.markShuttingDown();
    expect(cache.get()).toBeNull();
  });
});
