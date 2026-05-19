import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import type { TenantContext } from '../types/tenant-context.js';

const mocks = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  loggerDebug: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@insurtech/shared-utils', () => ({
  logger: {
    warn: mocks.loggerWarn,
    debug: mocks.loggerDebug,
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

const { withTenantContext } = await import('./with-tenant-context.js');

function makeManager(queryMock: ReturnType<typeof vi.fn>): EntityManager {
  return { query: queryMock } as unknown as EntityManager;
}

function makeDataSource(initialized = true, queryMock = vi.fn().mockResolvedValue([])): DataSource {
  const manager = makeManager(queryMock);
  return {
    isInitialized: initialized,
    transaction: vi.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
  } as unknown as DataSource;
}

const baseCtx: TenantContext = {
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  assureUserId: null,
  isSuperAdmin: false,
};

describe('withTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appel nominal -- retourne valeur du callback', async () => {
    const ds = makeDataSource();
    const result = await withTenantContext(ds, baseCtx, async () => 'ok');
    expect(result).toBe('ok');
  });

  it('transaction() est appelee exactement 1 fois', async () => {
    const ds = makeDataSource();
    await withTenantContext(ds, baseCtx, async () => null);
    expect(ds.transaction).toHaveBeenCalledTimes(1);
  });

  it('4 set_config executes dans la transaction', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    await withTenantContext(ds, baseCtx, async () => null);
    expect(queryMock).toHaveBeenCalledTimes(4);
    const calls = queryMock.mock.calls;
    expect(calls[0]![0]).toContain('current_tenant_id');
    expect(calls[1]![0]).toContain('is_super_admin');
    expect(calls[2]![0]).toContain('current_user_id');
    expect(calls[3]![0]).toContain('assure_user_id');
  });

  it('tenantId null + isSuperAdmin false -> throw', async () => {
    const ds = makeDataSource();
    const ctx: TenantContext = { tenantId: null, userId: null, assureUserId: null, isSuperAdmin: false };
    await expect(withTenantContext(ds, ctx, async () => null)).rejects.toThrow(
      'tenantId is null and isSuperAdmin is false',
    );
  });

  it('tenantId null + isSuperAdmin true -> succes (super admin sans tenant)', async () => {
    const ds = makeDataSource();
    const ctx: TenantContext = { tenantId: null, userId: null, assureUserId: null, isSuperAdmin: true };
    const result = await withTenantContext(ds, ctx, async () => 42);
    expect(result).toBe(42);
  });

  it('tenantId non null + isSuperAdmin true -> 4 set_config appeles normalement', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    const ctx: TenantContext = { ...baseCtx, isSuperAdmin: true };
    await withTenantContext(ds, ctx, async () => null);
    expect(queryMock).toHaveBeenCalledTimes(4);
  });

  it('callback throw -> erreur propagee', async () => {
    const ds = makeDataSource();
    await expect(
      withTenantContext(ds, baseCtx, async () => { throw new Error('cb-error'); }),
    ).rejects.toThrow('cb-error');
  });

  it('DataSource non initialise -> throw', async () => {
    const ds = makeDataSource(false);
    await expect(withTenantContext(ds, baseCtx, async () => null)).rejects.toThrow(
      'DataSource not initialized',
    );
  });

  it('callback async retourne objet complexe', async () => {
    const ds = makeDataSource();
    const expected = { id: '1', name: 'test' };
    const result = await withTenantContext(ds, baseCtx, async () => expected);
    expect(result).toBe(expected);
  });

  it('isSuperAdmin false -> is_super_admin set a false', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    await withTenantContext(ds, baseCtx, async () => null);
    const superAdminCall = queryMock.mock.calls[1] as [string, string[]];
    expect(superAdminCall[1]).toContain('false');
  });

  it('isSuperAdmin true -> is_super_admin set a true', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    const ctx: TenantContext = { tenantId: null, userId: null, assureUserId: null, isSuperAdmin: true };
    await withTenantContext(ds, ctx, async () => null);
    const superAdminCall = queryMock.mock.calls[1] as [string, string[]];
    expect(superAdminCall[1]).toContain('true');
  });

  it('assureUserId renseigne -> passe dans set_config', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    const ctx: TenantContext = { ...baseCtx, assureUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' };
    await withTenantContext(ds, ctx, async () => null);
    const assureCall = queryMock.mock.calls[3] as [string, string[]];
    expect(assureCall[1]).toContain('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  it('callback invoque apres les 4 set_config', async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const ds = makeDataSource(true, queryMock);
    let callsAtCallbackEntry = 0;
    await withTenantContext(ds, baseCtx, async () => {
      callsAtCallbackEntry = queryMock.mock.calls.length;
      return null;
    });
    expect(callsAtCallbackEntry).toBe(4);
  });
});
