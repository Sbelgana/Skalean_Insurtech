/**
 * Tests unitaires SuperAdminAuditInterceptor.
 *
 * Reference : Sprint 6 / Tache 2.2.10.
 */

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthRole,
  TenantContextService,
  buildMockTenantContext,
  withTenantContext,
} from '@insurtech/auth';
import { lastValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_ONLY_KEY,
  SUPER_ADMIN_ONLY_KEY,
} from '../decorators/metadata-keys.js';
import { SuperAdminAuditInterceptor } from './super-admin-audit.interceptor.js';

const buildExc = (
  overrides: { method?: string; url?: string; params?: Record<string, string> } = {},
): ExecutionContext =>
  ({
    getHandler: () => function fakeHandler(): void {},
    getClass: () => class FakeAdminController {},
    switchToHttp: () => ({
      getRequest: () => ({
        method: overrides.method ?? 'GET',
        url: overrides.url ?? '/api/v1/admin/tenants',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'vitest/1.0' },
        params: overrides.params ?? {},
      }),
    }),
  }) as unknown as ExecutionContext;

const buildHandler = (resultOrError: unknown, isError = false): CallHandler =>
  ({
    handle: () => (isError ? throwError(() => resultOrError) : of(resultOrError)),
  }) as unknown as CallHandler;

describe('SuperAdminAuditInterceptor', () => {
  let interceptor: SuperAdminAuditInterceptor;
  let reflector: Reflector;
  let tenantContext: TenantContextService;
  let loggerLog: ReturnType<typeof vi.spyOn>;
  let loggerError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    reflector = new Reflector();
    tenantContext = new TenantContextService();
    interceptor = new SuperAdminAuditInterceptor(reflector, tenantContext);
    // biome-ignore lint/suspicious/noExplicitAny: spy on private logger
    loggerLog = vi.spyOn((interceptor as any).logger, 'log').mockImplementation(() => undefined);
    // biome-ignore lint/suspicious/noExplicitAny: spy on private logger
    loggerError = vi
      // biome-ignore lint/suspicious/noExplicitAny: spy on private logger
      .spyOn((interceptor as any).logger, 'error')
      .mockImplementation(() => undefined);
  });

  it('1. skip when neither @AdminOnly nor @SuperAdminOnly present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const result = await lastValueFrom(
      interceptor.intercept(buildExc(), buildHandler({ ok: true })),
    );
    expect(result).toEqual({ ok: true });
    expect(loggerLog).not.toHaveBeenCalled();
  });

  it('2. emits super_admin_access_granted on @SuperAdminOnly route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
        userId: 'admin-1',
      }),
      async () => {
        await lastValueFrom(interceptor.intercept(buildExc(), buildHandler({ ok: 1 })));
      },
    );
    const grantedCall = loggerLog.mock.calls.find((c) =>
      String(c[0]).includes('super_admin_access_granted'),
    );
    expect(grantedCall).toBeDefined();
    expect(String(grantedCall?.[0])).toContain('user_id=admin-1');
    expect(String(grantedCall?.[0])).toContain('role=super_admin_platform');
  });

  it('3. emits super_admin_action_completed on success', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        await lastValueFrom(interceptor.intercept(buildExc(), buildHandler({ ok: 1 })));
      },
    );
    const completedCall = loggerLog.mock.calls.find((c) =>
      String(c[0]).includes('super_admin_action_completed'),
    );
    expect(completedCall).toBeDefined();
    expect(String(completedCall?.[0])).toContain('duration_ms=');
  });

  it('4. emits super_admin_action_failed on handler error', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    const handlerError = Object.assign(new Error('boom'), { status: 500 });
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        await lastValueFrom(
          interceptor.intercept(buildExc(), buildHandler(handlerError, true)),
        ).catch(() => undefined);
      },
    );
    const failedCall = loggerLog.mock.calls.find((c) =>
      String(c[0]).includes('super_admin_action_failed'),
    );
    expect(failedCall).toBeDefined();
    expect(String(failedCall?.[0])).toContain('status_code=500');
    expect(String(failedCall?.[0])).toContain('error=boom');
  });

  it('5. @AdminOnly also triggers audit', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        await lastValueFrom(interceptor.intercept(buildExc(), buildHandler({ ok: 1 })));
      },
    );
    expect(loggerLog).toHaveBeenCalled();
  });

  it('6. includes tenant_target when :id present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        await lastValueFrom(
          interceptor.intercept(
            buildExc({ params: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } }),
            buildHandler({ ok: 1 }),
          ),
        );
      },
    );
    const grantedCall = loggerLog.mock.calls.find((c) =>
      String(c[0]).includes('super_admin_access_granted'),
    );
    expect(String(grantedCall?.[0])).toContain('tenant_target=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('7. truncates long user_agent to 120 chars', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    const longUa = 'A'.repeat(500);
    const exc = {
      getHandler: () => function fakeHandler(): void {},
      getClass: () => class C {},
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/admin/x',
          ip: '127.0.0.1',
          headers: { 'user-agent': longUa },
          params: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        await lastValueFrom(interceptor.intercept(exc, buildHandler({ ok: 1 })));
      },
    );
    const grantedCall = loggerLog.mock.calls.find((c) =>
      String(c[0]).includes('super_admin_access_granted'),
    );
    expect(String(grantedCall?.[0])).toContain(`user_agent=${'A'.repeat(120)}`);
  });

  it('8. audit publish failure is silent (logger.error called, never throws)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === SUPER_ADMIN_ONLY_KEY ? true : undefined,
    );
    loggerLog.mockImplementation(() => {
      throw new Error('logger dead');
    });
    await withTenantContext(
      buildMockTenantContext({
        tenantId: undefined,
        isSuperAdmin: true,
        userRole: AuthRole.SuperAdminPlatform,
      }),
      async () => {
        const result = await lastValueFrom(
          interceptor.intercept(buildExc(), buildHandler({ ok: 1 })),
        );
        expect(result).toEqual({ ok: 1 });
      },
    );
    expect(loggerError).toHaveBeenCalled();
  });
});
