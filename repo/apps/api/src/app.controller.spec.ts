/**
 * Tests unitaires pour AppController (GET /).
 *
 * Utilise l'instanciation directe (sans NestJS TestingModule) pour eviter
 * la dependance a emitDecoratorMetadata dans l'environnement vitest/esbuild.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    // Instanciation directe : contourne le besoin de DI metadata (esbuild limitation).
    const service = new AppService();
    controller = new AppController(service);
  });

  it('GET / returns name containing skalean-insurtech-api', () => {
    process.env['APP_NAME'] = 'skalean-insurtech-api';
    const result = controller.getRoot();
    expect(result.name).toContain('skalean-insurtech-api');
  });

  it('GET / returns version string', () => {
    process.env['APP_VERSION'] = '0.1.0';
    const result = controller.getRoot();
    expect(typeof result.version).toBe('string');
    expect(result.version.length).toBeGreaterThan(0);
  });

  it('GET / returns env from process.env.NODE_ENV', () => {
    process.env['NODE_ENV'] = 'test';
    const result = controller.getRoot();
    expect(result.env).toBe('test');
  });

  it('GET / returns uptime_seconds as non-negative integer', () => {
    const result = controller.getRoot();
    expect(Number.isInteger(result.uptime_seconds)).toBe(true);
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('GET / returns ISO 8601 timestamp', () => {
    const result = controller.getRoot();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('GET / response has exactly the expected keys', () => {
    const result = controller.getRoot();
    expect(Object.keys(result).sort()).toEqual(
      ['env', 'name', 'timestamp', 'uptime_seconds', 'version'].sort(),
    );
  });
});
