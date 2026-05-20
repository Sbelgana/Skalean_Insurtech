/**
 * Tests integration TenantContextService avec NestJS TestingModule.
 *
 * Ces tests verifient :
 *   - Le service est bien provided comme @Global() (accessible partout).
 *   - L'isolation entre requests paralleles (100+ iterations stress test).
 *   - L'integration avec NestJS DI lifecycle.
 *
 * Reference : Sprint 6 / Tache 2.2.1.
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthRole } from '../types/auth-roles.js';
import type { TenantContext } from '../types/tenant-context.type.js';
import { TenantContextModule } from '../modules/tenant-context.module.js';
import { TenantContextService } from './tenant-context.service.js';

const baseCtx = (overrides: Partial<TenantContext> = {}): TenantContext => ({
  isSuperAdmin: false,
  traceId: 'trace-integration',
  ipAddress: '127.0.0.1',
  userAgent: 'integration-test',
  ...overrides,
});

describe('TenantContextService -- integration', () => {
  let module: TestingModule;
  let service: TenantContextService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TenantContextModule],
    }).compile();

    service = module.get<TenantContextService>(TenantContextService);
  });

  it('1. should be available via DI as @Global()', () => {
    expect(service).toBeInstanceOf(TenantContextService);
  });

  it('2. should isolate 100 parallel async contexts (stress)', async () => {
    const promises = Array.from({ length: 100 }, (_, i) => {
      const ctx = baseCtx({ tenantId: `tenant-${i}`, traceId: `trace-${i}` });
      return service.runWithContext(ctx, async () => {
        await new Promise((r) => setTimeout(r, Math.random() * 20));
        const observed = service.getCurrentTenantId();
        return { expected: ctx.tenantId, observed };
      });
    });

    const results = await Promise.all(promises);
    const leaks = results.filter((r) => r.expected !== r.observed);
    expect(leaks.length).toBe(0);
  });

  it('3. should isolate nested runs across async boundaries', async () => {
    const outerCtx = baseCtx({ tenantId: 'outer-tenant', traceId: 'outer-trace' });

    await service.runWithContext(outerCtx, async () => {
      const innerCtx = baseCtx({ tenantId: 'inner-tenant', traceId: 'inner-trace' });

      await service.runWithContext(innerCtx, async () => {
        await new Promise((r) => setTimeout(r, 10));
        expect(service.getCurrentTenantId()).toBe('inner-tenant');
      });

      expect(service.getCurrentTenantId()).toBe('outer-tenant');
    });
  });

  it('4. should correctly enrich getLogContext for Pino mixin', () => {
    const ctx = baseCtx({
      tenantId: 'tenant-log',
      userId: 'user-log',
      userRole: AuthRole.BrokerAdmin,
      isSuperAdmin: false,
      traceId: 'trace-log',
      correlationId: 'correlation-log',
    });

    service.runWithContext(ctx, () => {
      const logCtx = service.getLogContext();
      expect(logCtx).toMatchObject({
        tenant_id: 'tenant-log',
        user_id: 'user-log',
        user_role: AuthRole.BrokerAdmin,
        is_super_admin: false,
        trace_id: 'trace-log',
        correlation_id: 'correlation-log',
      });
    });
  });

  it('5. should maintain context through Promise.race scenarios', async () => {
    const ctx = baseCtx({ tenantId: 'tenant-race', traceId: 'trace-race' });

    const winner = await service.runWithContext(ctx, async () => {
      const slow = new Promise<string>((r) => setTimeout(() => r('slow'), 50));
      const fast = new Promise<string>((r) => setTimeout(() => r('fast'), 10));
      const result = await Promise.race([slow, fast]);
      return { result, observed: service.getCurrentTenantId() };
    });

    expect(winner.result).toBe('fast');
    expect(winner.observed).toBe('tenant-race');
  });

  it('6. should not leak context across iterations (200 sequential)', async () => {
    for (let i = 0; i < 200; i++) {
      const ctx = baseCtx({ tenantId: `iteration-${i}`, traceId: `t-${i}` });
      await service.runWithContext(ctx, async () => {
        await Promise.resolve();
        expect(service.getCurrentTenantId()).toBe(`iteration-${i}`);
      });
      expect(service.getCurrentContext()).toBeUndefined();
    }
  });
});
