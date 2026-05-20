/**
 * Tests KafkaHealthIndicator -- state tracking + timeout.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.10 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthCheckError } from '@nestjs/terminus';
import { KafkaHealthIndicator } from './kafka-health.indicator';

describe('KafkaHealthIndicator', () => {
  let indicator: KafkaHealthIndicator;
  const onListeners: Record<string, (event?: unknown) => void> = {};
  let mockProducer: {
    events: Record<string, string>;
    on: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    Object.keys(onListeners).forEach((k) => delete onListeners[k]);

    mockProducer = {
      events: {
        CONNECT: 'producer.connect',
        DISCONNECT: 'producer.disconnect',
        REQUEST_TIMEOUT: 'producer.request_timeout',
      },
      on: vi.fn((event: string, handler: (event?: unknown) => void) => {
        onListeners[event] = handler;
      }),
    };
    indicator = new KafkaHealthIndicator(mockProducer as never);
  });

  it('retourne healthy si state connected (defaut)', async () => {
    const result = await indicator.isHealthy('kafka', 1500);
    expect(result['kafka']?.status).toBe('up');
  });

  it('throw HealthCheckError si DISCONNECT event recu', async () => {
    onListeners['producer.disconnect']?.();
    await expect(indicator.isHealthy('kafka', 1500)).rejects.toThrow(HealthCheckError);
  });

  it('reconnecte apres CONNECT event', async () => {
    onListeners['producer.disconnect']?.();
    onListeners['producer.connect']?.();
    const result = await indicator.isHealthy('kafka', 1500);
    expect(result['kafka']?.status).toBe('up');
  });

  it('REQUEST_TIMEOUT event => disconnected + error', async () => {
    onListeners['producer.request_timeout']?.({
      payload: { broker: 'broker:9092' },
    });
    await expect(indicator.isHealthy('kafka', 1500)).rejects.toThrow(HealthCheckError);
  });

  it('throw HealthCheckError si state.connected est false et lastError defini', async () => {
    // Simule un etat deconnecte avec une erreur predefinie
    onListeners['producer.request_timeout']?.({ payload: { broker: 'b:9092' } });
    onListeners['producer.disconnect']?.();
    const err = await indicator.isHealthy('kafka', 1500).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HealthCheckError);
  });
});
