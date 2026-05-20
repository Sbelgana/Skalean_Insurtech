/**
 * Tests unitaires TenantContextService -- propagation AsyncLocalStorage,
 * helpers permissifs et stricts, edge cases isolation.
 *
 * Reference : Sprint 6 / Tache 2.2.1.
 */

import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthRole } from '../types/auth-roles.js';
import type { TenantContext } from '../types/tenant-context.type.js';
import {
  TENANT_CONTEXT_ERROR_CODES,
  TenantContextService,
  tenantContextStorage,
} from './tenant-context.service.js';

const buildBaseContext = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  isSuperAdmin: false,
  traceId: '01HZX1234567890123456789AB',
  ipAddress: '192.168.1.1',
  userAgent: 'vitest-test-agent/1.0',
  ...overrides,
});

describe('TenantContextService', () => {
  let service: TenantContextService;

  beforeEach(() => {
    service = new TenantContextService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GROUP 1 : runWithContext + getCurrentContext
  // ==========================================================================

  describe('runWithContext / getCurrentContext', () => {
    it('1. should make context available inside runWithContext synchronous', () => {
      const ctx = buildBaseContext({ tenantId: 'tenant-a-uuid' });
      let captured: TenantContext | undefined;

      service.runWithContext(ctx, () => {
        captured = service.getCurrentContext();
      });

      expect(captured).toEqual(ctx);
    });

    it('2. should propagate context through async/await', async () => {
      const ctx = buildBaseContext({ tenantId: 'tenant-async-uuid' });
      let captured: TenantContext | undefined;

      await service.runWithContext(ctx, async () => {
        await Promise.resolve();
        captured = service.getCurrentContext();
      });

      expect(captured?.tenantId).toBe('tenant-async-uuid');
    });

    it('3. should propagate context through setTimeout', async () => {
      const ctx = buildBaseContext({ tenantId: 'tenant-timeout-uuid' });
      let captured: TenantContext | undefined;

      await new Promise<void>((resolve) => {
        service.runWithContext(ctx, () => {
          setTimeout(() => {
            captured = service.getCurrentContext();
            resolve();
          }, 5);
        });
      });

      expect(captured?.tenantId).toBe('tenant-timeout-uuid');
    });

    it('4. should propagate context through Promise.all', async () => {
      const ctx = buildBaseContext({ tenantId: 'tenant-promise-all-uuid' });
      let capturedA: string | undefined;
      let capturedB: string | undefined;

      await service.runWithContext(ctx, async () => {
        await Promise.all([
          (async () => {
            await new Promise((r) => setTimeout(r, 1));
            capturedA = service.getCurrentTenantId();
          })(),
          (async () => {
            await new Promise((r) => setTimeout(r, 2));
            capturedB = service.getCurrentTenantId();
          })(),
        ]);
      });

      expect(capturedA).toBe('tenant-promise-all-uuid');
      expect(capturedB).toBe('tenant-promise-all-uuid');
    });

    it('5. should return undefined outside any runWithContext', () => {
      const ctx = service.getCurrentContext();
      expect(ctx).toBeUndefined();
    });

    it('6. should isolate two parallel runWithContext (zero leak)', async () => {
      const ctxA = buildBaseContext({ tenantId: 'tenant-A' });
      const ctxB = buildBaseContext({ tenantId: 'tenant-B' });
      const results: string[] = [];

      const promiseA = service.runWithContext(ctxA, async () => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(service.getCurrentTenantId() ?? 'undefined');
      });

      const promiseB = service.runWithContext(ctxB, async () => {
        await new Promise((r) => setTimeout(r, 5));
        results.push(service.getCurrentTenantId() ?? 'undefined');
      });

      await Promise.all([promiseA, promiseB]);

      expect(results).toContain('tenant-A');
      expect(results).toContain('tenant-B');
      expect(results).not.toContain('undefined');
    });
  });

  // ==========================================================================
  // GROUP 2 : Helpers permissifs (get*)
  // ==========================================================================

  describe('helpers permissifs', () => {
    it('7. getCurrentTenantId should return tenantId from context', () => {
      const ctx = buildBaseContext({ tenantId: 'a-tenant-uuid' });
      service.runWithContext(ctx, () => {
        expect(service.getCurrentTenantId()).toBe('a-tenant-uuid');
      });
    });

    it('8. getCurrentTenantId should return undefined for admin context', () => {
      const ctx = buildBaseContext({ isSuperAdmin: true, userId: 'admin-uuid' });
      service.runWithContext(ctx, () => {
        expect(service.getCurrentTenantId()).toBeUndefined();
      });
    });

    it('9. getCurrentUserId should return userId from context', () => {
      const ctx = buildBaseContext({ userId: 'user-uuid' });
      service.runWithContext(ctx, () => {
        expect(service.getCurrentUserId()).toBe('user-uuid');
      });
    });

    it('10. getCurrentUserRole should return userRole from context', () => {
      const ctx = buildBaseContext({ userRole: AuthRole.BrokerAdmin });
      service.runWithContext(ctx, () => {
        expect(service.getCurrentUserRole()).toBe(AuthRole.BrokerAdmin);
      });
    });

    it('11. isSuperAdmin should return true for admin context', () => {
      const ctx = buildBaseContext({ isSuperAdmin: true });
      service.runWithContext(ctx, () => {
        expect(service.isSuperAdmin()).toBe(true);
      });
    });

    it('12. isSuperAdmin should return false for normal tenant context', () => {
      const ctx = buildBaseContext({ tenantId: 'tenant', isSuperAdmin: false });
      service.runWithContext(ctx, () => {
        expect(service.isSuperAdmin()).toBe(false);
      });
    });

    it('13. isSuperAdmin should return false outside context', () => {
      expect(service.isSuperAdmin()).toBe(false);
    });

    it('14. getAssureUserId should return assureUserId from L3 context', () => {
      const ctx = buildBaseContext({
        tenantId: 'broker-tenant',
        assureUserId: 'assure-user-uuid',
      });
      service.runWithContext(ctx, () => {
        expect(service.getAssureUserId()).toBe('assure-user-uuid');
      });
    });

    it('15. getCrossTenantAuthId should return cross tenant auth id', () => {
      const ctx = buildBaseContext({
        tenantId: 'tenant-a',
        crossTenantAuthorizationId: 'auth-uuid',
      });
      service.runWithContext(ctx, () => {
        expect(service.getCrossTenantAuthId()).toBe('auth-uuid');
      });
    });

    it('16. getTenantSettings should return cached settings', () => {
      const settings = {
        locale: 'fr' as const,
        timezone: 'Africa/Casablanca',
        currency: 'MAD' as const,
        branding: { primaryColor: '#E95D2C', logoUrl: null },
        features: { mfaRequiredForAdmin: true, sinistreAutoAssign: false },
        quotas: { maxUsers: 10, maxPolices: 1000, maxStorageGb: 50 },
        tenantType: 'broker' as const,
      };
      const ctx = buildBaseContext({ tenantId: 't', tenantSettings: settings });
      service.runWithContext(ctx, () => {
        expect(service.getTenantSettings()).toEqual(settings);
      });
    });

    it('17. getTraceId should return traceId from context', () => {
      const ctx = buildBaseContext({ traceId: 'trace-xyz' });
      service.runWithContext(ctx, () => {
        expect(service.getTraceId()).toBe('trace-xyz');
      });
    });
  });

  // ==========================================================================
  // GROUP 3 : Helpers stricts (require*)
  // ==========================================================================

  describe('helpers stricts (require*)', () => {
    it('18. requireTenantId should return tenantId when present', () => {
      const ctx = buildBaseContext({ tenantId: 'present-tenant' });
      service.runWithContext(ctx, () => {
        expect(service.requireTenantId()).toBe('present-tenant');
      });
    });

    it('19. requireTenantId should throw InternalServerErrorException when missing', () => {
      service.runWithContext(buildBaseContext({}), () => {
        expect(() => service.requireTenantId()).toThrow(InternalServerErrorException);
      });
    });

    it('20. requireTenantId should throw with stable error code', () => {
      service.runWithContext(buildBaseContext({}), () => {
        try {
          service.requireTenantId();
        } catch (err) {
          const error = err as InternalServerErrorException;
          const response = error.getResponse() as { code: string };
          expect(response.code).toBe(TENANT_CONTEXT_ERROR_CODES.TENANT_CONTEXT_MISSING);
        }
      });
    });

    it('21. requireSuperAdmin should pass when isSuperAdmin true', () => {
      const ctx = buildBaseContext({ isSuperAdmin: true });
      service.runWithContext(ctx, () => {
        expect(() => service.requireSuperAdmin()).not.toThrow();
      });
    });

    it('22. requireSuperAdmin should throw ForbiddenException when not super admin', () => {
      const ctx = buildBaseContext({ tenantId: 't', isSuperAdmin: false });
      service.runWithContext(ctx, () => {
        expect(() => service.requireSuperAdmin()).toThrow(ForbiddenException);
      });
    });

    it('23. requireUserId should throw when no user authenticated', () => {
      service.runWithContext(buildBaseContext({}), () => {
        expect(() => service.requireUserId()).toThrow(InternalServerErrorException);
      });
    });

    it('24. requireUserId should return userId when present', () => {
      service.runWithContext(buildBaseContext({ userId: 'u-1' }), () => {
        expect(service.requireUserId()).toBe('u-1');
      });
    });

    it('25. requireAssureUserId should throw when no assure context', () => {
      const ctx = buildBaseContext({ tenantId: 'broker' });
      service.runWithContext(ctx, () => {
        expect(() => service.requireAssureUserId()).toThrow(ForbiddenException);
      });
    });

    it('26. requireAssureUserId should return assureUserId when present', () => {
      const ctx = buildBaseContext({ tenantId: 'broker', assureUserId: 'a-1' });
      service.runWithContext(ctx, () => {
        expect(service.requireAssureUserId()).toBe('a-1');
      });
    });
  });

  // ==========================================================================
  // GROUP 4 : runWithUpdatedContext
  // ==========================================================================

  describe('runWithUpdatedContext', () => {
    it('27. should merge updates with parent context', () => {
      const parentCtx = buildBaseContext({
        tenantId: 'parent-tenant',
        userId: 'parent-user',
      });

      service.runWithContext(parentCtx, () => {
        service.runWithUpdatedContext(
          { crossTenantAuthorizationId: 'new-auth-id' },
          () => {
            const ctx = service.getCurrentContext();
            expect(ctx?.tenantId).toBe('parent-tenant');
            expect(ctx?.userId).toBe('parent-user');
            expect(ctx?.crossTenantAuthorizationId).toBe('new-auth-id');
          },
        );
      });
    });

    it('28. should restore parent context after run completes', () => {
      const parentCtx = buildBaseContext({ tenantId: 'parent' });

      service.runWithContext(parentCtx, () => {
        service.runWithUpdatedContext({ tenantId: 'child' }, () => {
          expect(service.getCurrentTenantId()).toBe('child');
        });
        expect(service.getCurrentTenantId()).toBe('parent');
      });
    });

    it('29. should throw if no parent context', () => {
      expect(() =>
        service.runWithUpdatedContext({ tenantId: 'orphan' }, () => null),
      ).toThrow(InternalServerErrorException);
    });
  });

  // ==========================================================================
  // GROUP 5 : Observability getLogContext
  // ==========================================================================

  describe('getLogContext', () => {
    it('30. should return empty object when no context', () => {
      expect(service.getLogContext()).toEqual({});
    });

    it('31. should return all relevant fields for logger', () => {
      const ctx = buildBaseContext({
        tenantId: 'tenant-uuid',
        userId: 'user-uuid',
        userRole: AuthRole.BrokerAdmin,
        isSuperAdmin: false,
        traceId: 'trace-uuid',
        correlationId: 'correlation-uuid',
      });

      service.runWithContext(ctx, () => {
        const logCtx = service.getLogContext();
        expect(logCtx['tenant_id']).toBe('tenant-uuid');
        expect(logCtx['user_id']).toBe('user-uuid');
        expect(logCtx['user_role']).toBe(AuthRole.BrokerAdmin);
        expect(logCtx['is_super_admin']).toBe(false);
        expect(logCtx['trace_id']).toBe('trace-uuid');
        expect(logCtx['correlation_id']).toBe('correlation-uuid');
      });
    });
  });

  // ==========================================================================
  // GROUP 6 : Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('32. should handle nested runWithContext correctly', () => {
      const outer = buildBaseContext({ tenantId: 'outer' });
      const inner = buildBaseContext({ tenantId: 'inner' });

      service.runWithContext(outer, () => {
        expect(service.getCurrentTenantId()).toBe('outer');
        service.runWithContext(inner, () => {
          expect(service.getCurrentTenantId()).toBe('inner');
        });
        expect(service.getCurrentTenantId()).toBe('outer');
      });
    });

    it('33. should not leak context after run completes', () => {
      const ctx = buildBaseContext({ tenantId: 'transient' });
      service.runWithContext(ctx, () => {
        expect(service.getCurrentTenantId()).toBe('transient');
      });
      expect(service.getCurrentTenantId()).toBeUndefined();
    });

    it('34. should handle 1000 sequential runWithContext without leak', async () => {
      for (let i = 0; i < 1000; i++) {
        const ctx = buildBaseContext({ tenantId: `tenant-${i}` });
        await service.runWithContext(ctx, async () => {
          await Promise.resolve();
          expect(service.getCurrentTenantId()).toBe(`tenant-${i}`);
        });
      }
      expect(service.getCurrentContext()).toBeUndefined();
    });
  });

  // ==========================================================================
  // GROUP 7 : Module-level export tenantContextStorage
  // ==========================================================================

  describe('tenantContextStorage (module-level export)', () => {
    it('35. should be the same singleton accessible from service and module-level', () => {
      const ctx = buildBaseContext({ tenantId: 'singleton-test' });
      service.runWithContext(ctx, () => {
        const storeFromService = service.getCurrentContext();
        const storeFromModule = tenantContextStorage.getStore();
        expect(storeFromService).toBe(storeFromModule);
      });
    });
  });
});
