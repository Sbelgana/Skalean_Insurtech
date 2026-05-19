import { describe, it, expect, afterEach } from 'vitest';
import { startTelemetry, shutdownTelemetry } from './otel.js';

describe('OTEL telemetry -- Tache 1.1.12', () => {
  afterEach(async () => {
    await shutdownTelemetry();
  });

  it('startTelemetry initialises SDK without error', () => {
    expect(() => startTelemetry()).not.toThrow();
  });

  it('startTelemetry idempotent', () => {
    startTelemetry();
    expect(() => startTelemetry()).not.toThrow();
  });

  it('shutdownTelemetry flushes traces', async () => {
    startTelemetry();
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });
});
