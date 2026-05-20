/**
 * Tests PublicEndpointGuard -- pattern "secure by default".
 *
 * Verifie :
 *   - canActivate() retourne true pour les routes @Public()
 *   - canActivate() retourne true pour les routes non-@Public() (Sprint 3 pass-through)
 *   - Lecture metadata sur handler vs controller (getAllAndOverride precedence)
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.14 (Sprint 3 / Phase 1).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PublicEndpointGuard } from './public-endpoint.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cree un mock Reflector avec getAllAndOverride configurable. */
function makeReflector(isPublicValue: boolean | undefined) {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublicValue),
  };
}

/** Cree un ExecutionContext mock minimal. */
function makeContext() {
  return {
    getHandler: vi.fn().mockReturnValue(function handler() {}),
    getClass: vi.fn().mockReturnValue(class FakeController {}),
    switchToHttp: vi.fn(),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublicEndpointGuard', () => {
  it('canActivate() retourne true pour une route @Public()', () => {
    const reflector = makeReflector(true);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = makeContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('canActivate() retourne true pour une route non-@Public() (Sprint 3 pass-through)', () => {
    const reflector = makeReflector(false);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = makeContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('canActivate() retourne true si le metadata isPublic est undefined (pas de decorateur)', () => {
    const reflector = makeReflector(undefined);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = makeContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('reflector.getAllAndOverride est appele avec IS_PUBLIC_KEY', () => {
    const reflector = makeReflector(true);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = makeContext();
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.arrayContaining([expect.any(Function), expect.any(Function)]),
    );
  });

  it('reflector.getAllAndOverride recoit [handler, controller] dans cet ordre', () => {
    const reflector = makeReflector(undefined);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = makeContext();
    guard.canActivate(ctx);
    const args = reflector.getAllAndOverride.mock.calls[0] as [string, Function[]];
    expect(args[1]).toHaveLength(2);
  });

  it('canActivate() fonctionne meme si getHandler retourne un constructeur', () => {
    const reflector = makeReflector(true);
    const guard = new PublicEndpointGuard(reflector as unknown as import('@nestjs/core').Reflector);
    const ctx = {
      getHandler: vi.fn().mockReturnValue(class SomeHandler {}),
      getClass: vi.fn().mockReturnValue(class SomeController {}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
