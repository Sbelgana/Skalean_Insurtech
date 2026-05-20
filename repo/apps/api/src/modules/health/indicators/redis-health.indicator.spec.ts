/**
 * Tests RedisHealthIndicator -- PING + status check + timeout + sanitize.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis-health.indicator';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockRedis: { status: string; ping: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRedis = {
      status: 'ready',
      ping: vi.fn(),
    };
    indicator = new RedisHealthIndicator(mockRedis as never);
  });

  it('retourne healthy si PING retourne PONG', async () => {
    mockRedis.ping.mockResolvedValue('PONG');
    const result = await indicator.isHealthy('redis', 1000);
    expect(result['redis']?.status).toBe('up');
  });

  it('throw HealthCheckError si status !== ready', async () => {
    mockRedis.status = 'connecting';
    await expect(indicator.isHealthy('redis', 1000)).rejects.toThrow(HealthCheckError);
  });

  it('throw HealthCheckError si PING retourne autre que PONG', async () => {
    mockRedis.ping.mockResolvedValue('NOK');
    await expect(indicator.isHealthy('redis', 1000)).rejects.toThrow(HealthCheckError);
  });

  it('throw HealthCheckError si timeout depasse', async () => {
    mockRedis.ping.mockImplementation(() => new Promise(() => {}));
    await expect(indicator.isHealthy('redis', 100)).rejects.toThrow(HealthCheckError);
  });

  it('inclut duration_ms dans le result up', async () => {
    mockRedis.ping.mockResolvedValue('PONG');
    const result = await indicator.isHealthy('redis', 1000);
    const extra = result['redis'] as Record<string, unknown>;
    expect(typeof extra?.['duration_ms']).toBe('number');
  });

  it('sanitize redis URL dans lerreur', async () => {
    mockRedis.ping.mockRejectedValue(
      new Error('connect redis://admin:secret@cache.host:6379 failed'),
    );
    try {
      await indicator.isHealthy('redis', 1000);
    } catch (e) {
      const err = e as HealthCheckError;
      const msg = (err.causes as Record<string, Record<string, string>>)?.['redis']?.['message'] ?? '';
      expect(msg).not.toContain('secret');
    }
  });
});
