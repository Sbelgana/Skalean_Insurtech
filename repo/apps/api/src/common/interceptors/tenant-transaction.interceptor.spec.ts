/**
 * Tests unitaires TenantTransactionInterceptor -- branchements, set_config, exception rollback.
 *
 * Tests RLS reels Postgres : voir Tache 2.2.12 ou pause technique #4.
 *
 * Reference : Sprint 6 / Tache 2.2.4.
 */

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantContextService,
  buildMockTenantContext,
  withTenantContext,
} from '@insurtech/auth';
import type { DataSource } from '@insurtech/database';
import { lastValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SKIP_TENANT_TRANSACTION_KEY } from '../decorators/skip-tenant-transaction.decorator.js';
import {
  DatabaseTenantContextService,
  type QueryableEntityManager,
} from '../services/database-tenant-context.service.js';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.js';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';

const buildEm = (): QueryableEntityManager & { query: ReturnType<typeof vi.fn> } =>
  ({ query: vi.fn().mockResolvedValue([{ set_config: 'value' }]) }) as never;

const buildDataSource = (em: QueryableEntityManager): DataSource =>
  ({
    transaction: vi.fn(async (cb: (em: QueryableEntityManager) => Promise<unknown>) => cb(em)),
  }) as unknown as DataSource;

const buildContext = (): ExecutionContext =>
  ({
    getHandler: () => function fakeHandler(): void {},
    getClass: () => class FakeController {},
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as unknown as ExecutionContext;

const buildHandler = (resultOrError: unknown, isError = false): CallHandler =>
  ({
    handle: () => (isError ? throwError(() => resultOrError) : of(resultOrError)),
  }) as unknown as CallHandler;

describe('TenantTransactionInterceptor', () => {
  let interceptor: TenantTransactionInterceptor;
  let dataSource: DataSource;
  let em: ReturnType<typeof buildEm>;
  let tenantContext: TenantContextService;
  let reflector: Reflector;
  let dbCtx: DatabaseTenantContextService;

  beforeEach(() => {
    em = buildEm();
    dataSource = buildDataSource(em);
    tenantContext = new TenantContextService();
    reflector = new Reflector();
    dbCtx = new DatabaseTenantContextService();
    interceptor = new TenantTransactionInterceptor(dataSource, tenantContext, reflector, dbCtx);
  });

  // ==========================================================================
  // GROUP 1 : @SkipTenantTransaction()
  // ==========================================================================

  describe('@SkipTenantTransaction()', () => {
    it('1. skip transaction when @SkipTenantTransaction()', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SKIP_TENANT_TRANSACTION_KEY ? true : undefined,
      );
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(), buildHandler({ skipped: true })),
      );
      expect(result).toEqual({ skipped: true });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('2. handler executed when skipped', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
        key === SKIP_TENANT_TRANSACTION_KEY ? true : undefined,
      );
      const handler = buildHandler({ ok: 1 });
      const handleSpy = vi.spyOn(handler, 'handle');
      await lastValueFrom(interceptor.intercept(buildContext(), handler));
      expect(handleSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 2 : No context / public context
  // ==========================================================================

  describe('no transaction wrapping for non-tenant contexts', () => {
    it('3. skip transaction when no TenantContext active', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const result = await lastValueFrom(
        interceptor.intercept(buildContext(), buildHandler({ ok: true })),
      );
      expect(result).toEqual({ ok: true });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('4. skip transaction for public context (no tenantId, not super admin)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: undefined, isSuperAdmin: false }),
        async () => {
          const result = await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ public: true })),
          );
          expect(result).toEqual({ public: true });
        },
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GROUP 3 : Tenant context wraps + set_config
  // ==========================================================================

  describe('tenant context -> transaction with set_config', () => {
    it('5. open transaction for tenant context', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      expect(dataSource.transaction).toHaveBeenCalledOnce();
    });

    it('6. call set_config for tenant_id with $1 parameter binding', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      expect(em.query).toHaveBeenCalledWith(
        expect.stringContaining("set_config('app.current_tenant_id', $1, true)"),
        [TENANT_A],
      );
    });

    it('7. call set_config for user_id', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      expect(calls.some((c) => String(c[0]).includes('app.current_user_id'))).toBe(true);
    });

    it('8. handler result propagated through Observable', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          const result = await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ data: 'abc' })),
          );
          expect(result).toEqual({ data: 'abc' });
        },
      );
    });

    it('9. third arg true = local-to-transaction (auto reset on COMMIT)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      const tenantCall = calls.find((c) => String(c[0]).includes('current_tenant_id'));
      expect(tenantCall?.[0]).toContain(', $1, true)');
    });
  });

  // ==========================================================================
  // GROUP 4 : Super admin context
  // ==========================================================================

  describe('super admin context', () => {
    it('10. open transaction for super admin (no tenantId)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userId: 'admin-1',
        }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ admin: true })),
          );
        },
      );
      expect(dataSource.transaction).toHaveBeenCalledOnce();
    });

    it('11. set_config app.is_super_admin = true', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userId: 'admin-1',
        }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      expect(em.query).toHaveBeenCalledWith(
        expect.stringContaining("set_config('app.is_super_admin', 'true', true)"),
      );
    });

    it('12. does NOT set current_tenant_id for super admin without tenantId', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({
          tenantId: undefined,
          isSuperAdmin: true,
          userId: 'admin-1',
        }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      expect(calls.some((c) => String(c[0]).includes('current_tenant_id'))).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 5 : Assure L3 context
  // ==========================================================================

  describe('assure L3 context', () => {
    it('13. set_config assure_user_id when present', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({
          tenantId: TENANT_A,
          userId: USER_A,
          assureUserId: USER_A,
        }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      const assureCall = calls.find((c) => String(c[0]).includes('app.assure_user_id'));
      expect(assureCall).toBeDefined();
      expect(assureCall?.[1]).toEqual([USER_A]);
    });

    it('14. does not set_config assure_user_id when absent', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      expect(calls.some((c) => String(c[0]).includes('app.assure_user_id'))).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 6 : Cross-tenant authorization (Sprint 26 prep)
  // ==========================================================================

  describe('cross-tenant authorization', () => {
    it('15. set_config cross_tenant_authorization_id when present', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({
          tenantId: TENANT_A,
          userId: USER_A,
          crossTenantAuthorizationId: 'authz-1',
        }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      const calls = em.query.mock.calls;
      const xcall = calls.find((c) =>
        String(c[0]).includes('cross_tenant_authorization_id'),
      );
      expect(xcall).toBeDefined();
      expect(xcall?.[1]).toEqual(['authz-1']);
    });
  });

  // ==========================================================================
  // GROUP 7 : Exception handling / rollback
  // ==========================================================================

  describe('exception handling', () => {
    it('16. handler exception propagated (transaction rollback)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const handlerError = new Error('handler failed');
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await expect(
            lastValueFrom(
              interceptor.intercept(buildContext(), buildHandler(handlerError, true)),
            ),
          ).rejects.toThrow('handler failed');
        },
      );
    });

    it('17. transaction was opened even when handler throws', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler(new Error('x'), true)),
          ).catch(() => undefined);
        },
      );
      expect(dataSource.transaction).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // GROUP 8 : Connection pool isolation / zero-leak
  // ==========================================================================

  describe('zero-leak invariants', () => {
    it('18. 10 sequential requests different tenants -> each gets own set_config', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const tenants = Array.from(
        { length: 10 },
        (_, i) => `4444${String(i).padStart(4, '0')}-4444-4444-8444-444444444444`,
      );
      for (const t of tenants) {
        em.query.mockClear();
        await withTenantContext(
          buildMockTenantContext({ tenantId: t, userId: USER_A }),
          async () => {
            await lastValueFrom(
              interceptor.intercept(buildContext(), buildHandler({ ok: true })),
            );
          },
        );
        const tenantCall = em.query.mock.calls.find((c) =>
          String(c[0]).includes('current_tenant_id'),
        );
        expect(tenantCall?.[1]).toEqual([t]);
      }
    });

    it('19. 50 parallel contexts -> each gets correct set_config', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const recordedTenants: Array<string | null> = [];
      const dynamicEm = (): QueryableEntityManager => ({
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          if (sql.includes('current_tenant_id') && params) {
            recordedTenants.push((params[0] as string) ?? null);
          }
          return [];
        }),
      });
      const dynamicDS = {
        transaction: vi.fn(async (cb: (em: QueryableEntityManager) => Promise<unknown>) =>
          cb(dynamicEm()),
        ),
      } as unknown as DataSource;
      const dynamicInterceptor = new TenantTransactionInterceptor(
        dynamicDS,
        tenantContext,
        reflector,
        dbCtx,
      );

      const promises = Array.from({ length: 50 }, (_, i) => {
        const t = `5555${String(i).padStart(4, '0')}-5555-4555-8555-555555555555`;
        return withTenantContext(
          buildMockTenantContext({ tenantId: t, userId: USER_A }),
          async () => {
            await lastValueFrom(
              dynamicInterceptor.intercept(buildContext(), buildHandler({ ok: true })),
            );
            return t;
          },
        );
      });

      const tenantsRequested = await Promise.all(promises);
      expect(recordedTenants.sort()).toEqual(tenantsRequested.sort());
    });

    it('20. context not leaked after interceptor completes', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );
      expect(tenantContext.getCurrentContext()).toBeUndefined();
    });

    it('21. cross-tenant A then B same connection -> no residual A in B', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      em.query.mockClear();
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_A, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );

      em.query.mockClear();
      await withTenantContext(
        buildMockTenantContext({ tenantId: TENANT_B, userId: USER_A }),
        async () => {
          await lastValueFrom(
            interceptor.intercept(buildContext(), buildHandler({ ok: true })),
          );
        },
      );

      const tenantCallsInB = em.query.mock.calls.filter((c) =>
        String(c[0]).includes('current_tenant_id'),
      );
      expect(tenantCallsInB.length).toBe(1);
      expect(tenantCallsInB[0]?.[1]).toEqual([TENANT_B]);
    });
  });

  // ==========================================================================
  // GROUP 9 : Reflector usage
  // ==========================================================================

  describe('reflector usage', () => {
    it('22. reflector.getAllAndOverride called with handler + class', async () => {
      const spy = vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const exc = buildContext();
      await lastValueFrom(interceptor.intercept(exc, buildHandler({ ok: true })));
      const [key, targets] = spy.mock.calls[0]!;
      expect(key).toBe(SKIP_TENANT_TRANSACTION_KEY);
      expect(Array.isArray(targets)).toBe(true);
    });
  });
});
