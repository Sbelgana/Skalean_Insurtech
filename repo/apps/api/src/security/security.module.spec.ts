/**
 * Tests SecurityModule -- charge le module et verifie le provider PublicEndpointGuard.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { SecurityModule } from './security.module';
import { PublicEndpointGuard } from '../guards/public-endpoint.guard';

describe('SecurityModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) await module.close();
  });

  it('charge SecurityModule sans erreur', async () => {
    module = await Test.createTestingModule({
      imports: [SecurityModule],
    }).compile();
    expect(module).toBeDefined();
  });

  it('expose PublicEndpointGuard via DI', async () => {
    module = await Test.createTestingModule({
      imports: [SecurityModule],
    }).compile();
    const guard = module.get(PublicEndpointGuard);
    expect(guard).toBeInstanceOf(PublicEndpointGuard);
  });

  it('PublicEndpointGuard.canActivate() est une fonction', async () => {
    module = await Test.createTestingModule({
      imports: [SecurityModule],
    }).compile();
    const guard = module.get(PublicEndpointGuard);
    expect(typeof guard.canActivate).toBe('function');
  });
});
