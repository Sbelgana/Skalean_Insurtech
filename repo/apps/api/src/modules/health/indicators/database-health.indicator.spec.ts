/**
 * Tests DatabaseHealthIndicator -- SELECT 1 + timeout + sanitize.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @insurtech/database pour eviter loadEnv() au boot du module.
vi.mock('@insurtech/database', () => ({
  AppDataSource: {
    isInitialized: false,
    initialize: vi.fn(async () => {}),
    query: vi.fn(),
  },
}));
import { HealthCheckError } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database-health.indicator';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let mockDataSource: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDataSource = {
      query: vi.fn(),
    };
    indicator = new DatabaseHealthIndicator(mockDataSource as never);
  });

  it('retourne healthy si SELECT 1 reussit', async () => {
    mockDataSource.query.mockResolvedValue([{ healthy: 1 }]);
    const result = await indicator.isHealthy('db', 2000);
    expect(result['db']?.status).toBe('up');
  });

  it('throw HealthCheckError si query echoue', async () => {
    mockDataSource.query.mockRejectedValue(new Error('connection refused'));
    await expect(indicator.isHealthy('db', 2000)).rejects.toThrow(HealthCheckError);
  });

  it('throw HealthCheckError si timeout depasse', async () => {
    mockDataSource.query.mockImplementation(() => new Promise(() => {}));
    await expect(indicator.isHealthy('db', 100)).rejects.toThrow(HealthCheckError);
  });

  it('inclut duration_ms >= 0 dans le result up', async () => {
    mockDataSource.query.mockResolvedValue([{ healthy: 1 }]);
    const result = await indicator.isHealthy('db', 2000);
    const extra = result['db'] as Record<string, unknown>;
    expect(typeof extra?.['duration_ms']).toBe('number');
    expect(extra?.['duration_ms'] as number).toBeGreaterThanOrEqual(0);
  });

  it('sanitize la connection string dans lerreur', async () => {
    mockDataSource.query.mockRejectedValue(
      new Error('connect to postgres://admin:s3cr3t@db.host:5432/mydb failed'),
    );
    try {
      await indicator.isHealthy('db', 2000);
    } catch (e) {
      const err = e as HealthCheckError;
      const msg = (err.causes as Record<string, Record<string, string>>)?.['db']?.['message'] ?? '';
      expect(msg).not.toContain('s3cr3t');
      expect(msg).toContain('[REDACTED]');
    }
  });
});
