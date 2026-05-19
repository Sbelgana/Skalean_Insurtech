import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';

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

const { withSuperAdmin } = await import('./with-super-admin.js');

function makeDataSource(initialized = true): DataSource {
  const queryMock = vi.fn().mockResolvedValue([]);
  const manager = { query: queryMock } as unknown as EntityManager;
  return {
    isInitialized: initialized,
    transaction: vi.fn().mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    _queryMock: queryMock,
  } as unknown as DataSource;
}

describe('withSuperAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appel nominal -- retourne valeur du callback', async () => {
    const ds = makeDataSource();
    const result = await withSuperAdmin(ds, async () => 'superadmin-ok');
    expect(result).toBe('superadmin-ok');
  });

  it('DataSource non initialise -> throw', async () => {
    const ds = makeDataSource(false);
    await expect(withSuperAdmin(ds, async () => null)).rejects.toThrow('DataSource not initialized');
  });

  it('callback throw -> erreur propagee', async () => {
    const ds = makeDataSource();
    await expect(withSuperAdmin(ds, async () => { throw new Error('sa-err'); })).rejects.toThrow('sa-err');
  });

  it('callback recoit EntityManager avec methode query', async () => {
    const ds = makeDataSource();
    let capturedManager: EntityManager | null = null;
    await withSuperAdmin(ds, async (manager) => {
      capturedManager = manager;
      return null;
    });
    expect(capturedManager).not.toBeNull();
    expect(typeof (capturedManager as unknown as EntityManager).query).toBe('function');
  });

  it('is_super_admin set a true dans set_config', async () => {
    const ds = makeDataSource();
    const { _queryMock } = ds as unknown as { _queryMock: ReturnType<typeof vi.fn> };
    await withSuperAdmin(ds, async () => null);
    expect(_queryMock.mock.calls[0]![0]).toContain('is_super_admin');
    expect(_queryMock.mock.calls[0]![0]).toContain('true');
  });
});
